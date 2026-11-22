# Najdi a obnov svou práci

Najdi návrh, který jsi nikdy neuložil, stažený soubor, verzi z minulého týdne nebo svou práci po vymazání prohlížeče. Začni tabulkou.

Osobní práce zůstává v prohlížeči nebo aplikaci, kde jsi ji vytvořil, na daném zařízení, pokud nezapneš [Sync](/info/sync.html). Organizace používající volitelné Lolly Work také uchovává **Team projects** na svém serveru.

| Co jsi udělal | Kde hledat |
|---|---|
| Stiskl **Save as** nebo **Save** | **Projects** |
| Stiskl **Download** | Stažené soubory v prohlížeči a kopie v **Assets** |
| Ani jedno, v [nástroji, který ukládá při práci](#which-tools-save-as-you-work) | **Projects** a **History** |
| Ani jedno, v nástroji, který to nedělá | Jen karta, ve které jsi pracoval, dokud ji nezavřeš |
| Smazal to v aplikaci | **Trash** v **Projects**, **Assets** nebo **Settings → Storage**, po dobu 30 dnů |

::: figure find-your-work-places
Kde je tvá práce: vlastní úložiště prohlížeče uchovává Projects, History a Trash; stažené soubory jdou do složek zařízení; Sync a záložní soubor jsou kopie mimo prohlížeč.
:::

::: details Najdi sdílenou práci v Lolly Work (volitelné)
Otevři Lolly své organizace, přihlas se a podívej se do **Projects → Team projects**. Tato instance obsahuje sdílené relace a ukazuje ty, ke kterým máš přístup. Přihlášení na jiném zařízení může obnovit přístup k těmto relacím. Přihlášení neobnoví tvou osobní knihovnu ani zálohu zařízení.

Při [spolupráci přes Lolly Work](/info/collaborate.html#collabs-through-lolly-work-optional) před odchodem počkej na **Saved to work**. Pokud sdílený projekt chybí, ověř, že jsi připojený ke správné instanci, a zeptej se jejího provozovatele na přístup nebo dobu uchovávání. Vymazání dat prohlížeče odstraní místní kopie, ne kopii na serveru organizace. Viz [Používej Lolly ve své organizaci](/info/organisation.html).
:::

<!--i:eti-search-->
## Najdi něco, co jsi uložil

1. Stiskni **Home** vlevo nahoře v nástroji.
2. Otevři kartu **Projects** nahoře na domovské obrazovce (na telefonu ikona složky).
3. Vše, co jsi uložil do **My library**, je na první obrazovce. Každý projekt je složka. Chceš-li hledat ve všech složkách, piš do **Search all projects…** dole na obrazovce.

Položka přebírá název souboru, který jsi zadal v panelu exportu. Bez názvu souboru přebírá název svého nástroje, například **QR Code**. Otevření položky obnoví všechna nastavení. Uložení nové práce popisuje [Ukládání a pokračování](/info/using.html#saving-continuing).

::: note Není v Projects?
- Může být v **Trash**: viz [Vrať si něco, co jsi smazal](#get-back-something-you-deleted).
- Jiný prohlížeč, soukromé okno nebo jiné zařízení začíná prázdné, pokud nepoužíváš [Sync](/info/sync.html) nebo [nepřeneseš svou práci](#move-your-work-to-another-device).
- Pokud jsi stiskl jen **Download**, viz [Najdi stažený soubor](#find-a-file-you-downloaded).
:::

::: details Práce s Projects
Zobrazení **Projects** můžeš otevřít také přes **Settings → Storage → Saved sessions → Organise in Projects**. Funguje jako správce souborů:

![Projects před prvním uložením: dlaždice New folder, New asset a Templates, hodiny History vpravo nahoře a lišta Search all projects dole](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Vnořené složky.** Ukládej relace do složek a složky do dalších složek, do libovolné hloubky. Vytvoř nebo přejmenuj složku nebo přetáhni dlaždici na složku, abys ji přesunul. Drobečková navigace tě vrátí o úroveň výš. Relace uložené bez složky jsou v kořeni **Projects**.
- <!--i:clock--> **Řazení podle tebe.** **View options**, tlačítko s posuvníky vpravo nahoře, nabízí **Grid** nebo **List** a řazení podle **Name**, **Date added**, **Last modified** (výchozí), **Size** a uvnitř složky **By tool**. Složky jsou vždy první. Relace i složky se řadí každé ve své skupině.
- <!--i:document--> **Zařaď novou práci rovnou.** **New asset** otevře společný výběr. Zvol **Templates**, pokud chceš začít z uložené šablony. Otevři šablonu k úpravám nebo stiskni **+ Add** a nové dílo hned ulož.
- <!--i:checklist--> **Vícenásobný výběr (desktop).** Zaškrtni políčko dlaždice, táhni výběrový obdélník přes prázdné místo nebo použij **Shift/Cmd-kliknutí**. Kontextovou nabídku dlaždice otevřeš **kliknutím pravým tlačítkem** na dlaždici. Lišta výběru nabízí **Render selection**, **Move to…**, **New folder** a **Delete** (do Trash). Její **Edit together** otevře dvě až osm relací jednotlivých nástrojů vedle sebe s jedním postranním panelem. **Edit as sheet** otevře výběr libovolné velikosti nebo složení jako řádky v dávkové mřížce.
- <!--i:download--> **Vykresli celou složku nebo výběr.** **Render folder** exportuje každou uloženou relaci ve složce a jejích podsložkách jako jeden `.zip` s vnořenou strukturou. **Render selection** udělá totéž pro vícenásobný výběr. Jedna relace se vykreslí do vlastního souboru.
- <!--i:link--> **Přejdi rovnou na uloženou práci nástroje.** Zaškrtni jeden nebo více nástrojů v galerii Tools a na liště výběru zvol **View sessions**. Projects pak ukáže jen relace vytvořené těmito nástroji. **Clear** vrátí úplné zobrazení.
- <!--i:link--> **Sdílej uloženou relaci.** Klikni na relaci pravým tlačítkem (na telefonu stiskni **•••** na její dlaždici) a zvol **Share link**. Odkaz znovu otevře relaci se stejným nastavením. Obrázky z tvého zařízení se odkazem nepřenášejí. Celý dialog Share popisuje [Sdílení práce](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Přejmenuj nebo zkopíruj relaci.** Stejná nabídka obsahuje **Rename**, **Duplicate** (kopie ve stejné složce) a **Move to…**.

![Vyskakovací okno View options v Projects: Layout s Grid a List a Sort by nastavené na Last modified, vedle tlačítka pro obrácení pořadí](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

<!--i:eti-refresh-->
## Pokud jsi zavřel kartu nebo opustil nástroj

Co se obnoví, závisí na způsobu odchodu a na nástroji:

- **Zavřel jsi kartu nebo ses vrátil jindy.** Neuložená práce je pryč, kromě [nástrojů, které ukládají při práci](#which-tools-save-as-you-work). Takovou práci otevři z **Projects**.
- **Znovu jsi načetl stránku ve stejné kartě.** Tvá nastavení se obnoví z adresy stránky. V nástrojích, které neukládají při práci, adresa neobsahuje obrázky a soubory z tvého zařízení ani jednořádkový text delší než 150 znaků, takže ty se neobnoví.
- **Stiskl jsi Home nebo tlačítko zpět vlevo nahoře.** Pokud jsi od posledního uložení, stažení nebo zkopírování něco změnil, dialog **Unsaved edits** se zeptá, jestli chceš nejdřív uložit. **Save & leave** uloží práci a přejde do **Projects** nebo zpět do složky projektu, ze které jsi práci otevřel. **Leave anyway** zahodí tvé změny. Uložená položka se vrátí k poslednímu uložení a dílo, které jsi nikdy neuložil, zmizí z **Projects**. **Cancel** tě ponechá v nástroji.

::: warning Zavření karty se nejdřív neptá
Zavření karty, opětovné načtení a vlastní tlačítko Zpět v prohlížeči se nikdy neptají. Pro jistotu stiskni **Save as** nebo **Save** v panelu exportu, než nástroj opustíš.
:::

Když automatická obnova není dostupná, poznámka vedle ovládacích prvků pro úpravy říká, co si máš uchovat:

- V nástroji, který pracuje s vloženým souborem, ulož svá nastavení a uchovej i původní soubory.
- V nástroji pro nahrávání nebo v utilitě bez akce Save před odchodem ulož nebo stáhni výsledek.
- Desktopové a mobilní aplikace uvádějí, kdy musíš uložit ručně.
- Při soukromé spolupráci uchovává dokument a jeho historii, včetně změn druhého člověka, ten, kdo pozval. Ten, kdo se připojil, pracuje na dočasné kopii a před koncem relace by si měl uložit samostatnou kopii.

::: note Odešel jsi omylem bez uložení?
V nástrojích, které ukládají při práci, uchovává History kopii zahozených úprav po dobu 30 dnů. Otevři stránku **History**, najdi je v **Changes** a stiskni **Open as a copy**. V ostatních nástrojích jsou změny pryč.
:::

::: details Které nástroje ukládají při práci
Ve webové aplikaci ukládá při práci každý nástroj, který vytváří dokument, například Lolly Design, Lolly Chart, QR Code, Text a Lolly Sandbox. Tyto nástroje to nedělají:

- nástroje, které pracují s vloženým souborem, například Redact, Sign nebo Convert Image, protože Lolly nikdy neuchovává kopii tohoto souboru;
- nástroje, které nahrávají z kamery, mikrofonu nebo obrazovky, například Record, Lolly Screen Capture a Lolly Voice Recorder;
- nástroj, ve kterém není co měnit, například Countdown.

V ostatních nástrojích první změna zařadí práci do **Projects**, jako bys ji uložil. Pozdější změny se uchovají, jakmile nástroj dokončí vykreslování. Neuložené dílo zůstane v Projects po zavření karty a znovu se otevře se změnami označenými jako neuložené.

**Leave anyway** tyto změny přesto zahodí. Opětovné otevření nástroje z domovské obrazovky začne nové dílo; to dřívější otevři z Projects.

3D a Lolly Darkroom ukládají při práci, ale neuchovávají soubor, který do nich načteš, například 3D model nebo LUT. History a **Save** uchovávají název, typ a velikost souboru, nikoli soubor samotný. Když práci znovu otevřeš, poznámka uvede, o který soubor jde, a nástroj pracuje bez něj, dokud ho znovu nenačteš. Uchovej své původní soubory.

Se zapnutým [Sync](/info/sync.html) se takto zařazené dílo přenese na tvá další zařízení. Jeho verze zůstávají na zařízení, kde vznikly.

Pokud je dílo otevřené ve dvou kartách a uložíš ho v obou, zachová se poslední uložení. Nahrazená práce je v **Protected drafts** v History daného díla s akcí **Open draft as a copy**.

Funguje to jen ve webové aplikaci, ne v desktopových ani mobilních aplikacích a ne při živé spolupráci s někým dalším.
:::

<!--i:eti-download-->
## Najdi stažený soubor

V prohlížeči předá **Download** soubor prohlížeči. Ten ho uloží do své složky pro stažené soubory (obvykle **Downloads**) nebo se zeptá kam. Lolly nedostane informaci, kam soubor šel, takže se podívej do seznamu stažených souborů v prohlížeči.

Pokud se žádný soubor neobjevil, podívej se do panelu exportu, dokud jsi ještě v nástroji. Pod **Download** je řádek s názvem souboru a časem a s akcí **Retry download**. V Chrome, Edge a dalších prohlížečích na bázi Chromium řádek nabízí také **Save file…** pro výběr složky. Řádek i jeho soubor zůstávají, dokud neopustíš nástroj, znovu nenačteš stránku nebo znovu neexportuješ.

Lolly také po každém stažení uchovává dvě věci:

- **Kopii souboru** v **Assets** pod **Your uploads**, pokud je zapnuté **Save my renders to my library** v **Settings → Your renders** (**Settings** je dole na domovské obrazovce). Nastavení je ve výchozím stavu zapnuté. U videa nebo souboru většího než 50 MB se nejdřív zeptá a zip se nekopíruje.
- **Použitá nastavení** pro posledních 24 stažení. **Recent exports** pod uloženou prací v **Projects** znovu otevře nástroj s těmito nastaveními. Obrázky a soubory, které jsi přidal ze svého zařízení, nejsou zahrnuté. Stejný seznam je v **Settings → Activity & stats → Latest exports** a na kartě **Changes** v **History**.

::: details V desktopových a mobilních aplikacích
- **Desktopová aplikace:** **Download** ukládá do složky **Lolly** ve tvé složce **Downloads**, bez dialogu. Řádek pod **Download** říká, kam soubor šel, například "Uloženo do Downloads/Lolly", s akcí **Show in folder**. **Open Exports Folder** v nabídce **Window** nebo **Exports** otevře složku kdykoli. Soubor se stejným názvem jako dřívější se uloží jako "name (1)".
- **iPhone a iPad:** soubor se uloží v aplikaci **Files** pod **Lolly** a otevře se panel sdílení. Řádek pod **Download** uvádí "Uloženo do Files → Lolly".
- **Android:** otevře se nabídka sdílení. Vyber, kam soubor půjde.

Na iPhone, iPad a Android nový soubor nahradí dřívější soubor se stejným názvem.
:::

<!--i:eti-history-->
## Vrať se k dřívější verzi

- **Během této návštěvy:** **Undo** prochází zpět posledních 100 změn, dokud neopustíš nástroj nebo znovu nenačteš stránku. Viz [Zpět a znovu](/info/using.html#undo-and-redo).
- **V [nástrojích, které ukládají při práci](#which-tools-save-as-you-work):** se uchovávají dřívější verze každého díla.
- **Vše na zařízení:** se zapnutým [Sync](/info/sync.html) obnoví **Restore an earlier copy** v **Settings → Connected services** jednu z posledních sedmi denních kopií nebo kopii před posledním použitím změn. Vše na tomto zařízení pak odpovídá dané kopii.

Dřívější verzi otevřeš takto:

1. Stiskni **History**, tlačítko s hodinami vedle **Undo** a **Redo**. V Lolly Design je **History** v horní liště. Na telefonu stiskni **•••** a pak **History**. V nástrojích bez **Undo**, například Text a Lolly Sandbox, je **History** vedle **Home** vlevo nahoře.
2. Najdi verzi podle data a času. Řádky **Automatic checkpoint** vznikají při práci; řádky **Saved version** odpovídají okamžikům, kdy jsi ukládal.
3. Stiskni **Open as a copy**. Verze se otevře jako nové dílo a to, které jsi měl otevřené, zůstane, jak bylo. Kopie je v **Projects** s "(copy)" za názvem.

Chceš-li uchovat verzi pod názvem, stiskni **Name version**, zadej název a stiskni **Keep milestone**. Pojmenované verze jsou vypsané na stránce **History** v **Milestones**.

::: details Panel History a stránka History
Panel **History** vypisuje také řádky **Recovered work** a **Protected drafts** uchovává tvé poslední úpravy mezi kontrolními body s akcí **Open draft as a copy**. **Lolly Compare** a **Check assets** ti pomohou vybrat, než otevřeš kopii. Přepni **This creation** na **All history on this device** a uvidíš všechna díla.

Automatické kontrolní body s časem řídnou: jeden za minutu za poslední hodinu, jeden za hodinu za poslední den, jeden za den po dobu 30 dnů a pak jeden za týden. Všechny uložené a pojmenované verze zůstávají. Smazání díla přesune do **Trash** i jeho verze a **Delete forever** je odstraní.

Když se úložiště History zaplní, nejdřív se odstraní nejstarší automatické kontrolní body děl, která jsi 30 dnů neotevřel. I pak se ale uložení vždy zachová. Zapíše se jako aktuální práce a History uvede, že toto uložení není uchované jako verze. **Settings → Storage** ukazuje, kolik místa History zabírá.

Stránka **History** (`#/history`) zahrnuje všechna díla v tomto prohlížeči. Otevřeš ji tlačítkem s hodinami vpravo nahoře na domovské obrazovce nebo v **Projects**, volbou **Saved sessions** v nabídce profilu (na telefonu kulaté tlačítko s logem vpravo nahoře) nebo stisknutím **Open app history** v panelu History nástroje. Desktopové a mobilní aplikace stránku History nemají. Tlačítko s hodinami na domovské obrazovce a **Saved sessions** tam otevírají **Your recent work**: tvé poslední uložené relace a exporty s odkazem na Projects.

- **Recent** vypisuje tvá díla od nejnovějšího s akcí **Resume**.
- **Changes** řadí kontrolní body, stažení a výsledky Convert na jednu časovou osu. Stažení má akci **Reopen settings**.
- **Milestones** vypisuje pojmenované verze.

Každé dílo je dlaždice se svým obrázkem. **Grid** nebo **List** přepíná rozvržení. Filtruj podle projektu, nástroje a data (na telefonu pod **Filters**). Nabídka dlaždice (pravé kliknutí nebo dlouhý stisk) nabízí **Resume**, **Versions**, **Show in Projects** a **Move to Trash**. Pokud chceš odstranit několik děl, vyber je a zvol **Move to Trash**, které nabídne Undo.
:::

<!--i:eti-folder-move-->
## Přenes svou práci na jiné zařízení

| Cíl | Použij |
|---|---|
| Udržovat zařízení synchronizovaná | **Sync across devices** v **Settings → Connected services**: viz [Synchronizuj svá zařízení](/info/sync.html) |
| Přenést vše jednorázově | **Export my data** a **Import data…**, níže |
| Předat jeden návrh nebo jeden projekt | Soubor `.lolly`: **Export**, pak **Share**, pak **Download .lolly**; pro celý projekt **Download project (.lolly)** v nabídce složky. Na druhém zařízení stiskni **Open**. Viz [Soubor .lolly](/info/using.html#the-lolly-file) |

Odkaz pro sdílení přenáší tvá nastavení, ale ne obrázky ani soubory, které jsi přidal ze svého zařízení.

::: note Import přidává a nic nemaže
Složky, oblíbené položky a šablony ze souboru se přidají k těm, které už jsou na druhém zařízení. Když je uložená položka na obou, zachová se později uložená kopie. Tvé údaje a nastavení na daném zařízení zůstávají, jak jsou. Prázdné se doplní ze souboru. **Bring it to this device** v Sync funguje stejně.
:::

Jednorázový přenos všeho:

1. Na starém zařízení otevři **Settings → Storage** a pod **Move to another device** stiskni **Export my data**. Lolly stáhne jeden soubor `.zip`, jehož název začíná na `LollyTools-`.
2. Přenes soubor přes USB, e-mailem sobě, přes AirDrop nebo sdílenou složku.
3. Na novém zařízení otevři **Settings → Storage**, stiskni **Import data…**, vyber soubor a stiskni **Import**.

::: note Co zůstává na původním zařízení
Přihlášení, klíče a heslová fráze pro synchronizaci zůstávají na každém zařízení. Seznam posledních stažení, obsah stažený pro offline použití a modely AI se nepřenášejí žádnou cestou. Historie verzí se přenáší jen v souboru **Export my data**, ne přes Sync ani `.lolly`. Když je historie pro jeden soubor příliš velká, nejstarší automatické kontrolní body se vynechají a řádek exportu uvede jejich počet. Kopii, kterou Sync uchovává ve tvém úložišti, můžeš stáhnout a otevřít nebo ji vybrat v **Import data…** jako záložní soubor. Šifrovaná kopie si vyžádá tvou heslovou frázi.
:::

::: details Co obsahuje záložní soubor
Soubor se jmenuje `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Části názvu pocházejí z tvého profilu a vynechají se, pokud nejsou nastavené. `<n>` počítá exporty provedené ve stejný den. Obsahuje tvůj profil se složkami, Trash, šablonami a oblíbenými položkami; každou uloženou relaci s miniaturou; tvé nahrané obrázky, písma, loga a kopie stažených souborů; tvé designové systémy; tvé předvolby (motiv, šířku postranního panelu, místní statistiky aktivity); uložené verze a výsledky z Convert; a z webové aplikace historii verzí tvých děl.

Mezipaměť katalogu není zahrnutá. Nové zařízení ji stáhne znovu. Každá část má kontrolní součet, takže import zachytí soubor poškozený při přenosu. Uložené relace se znovu propojí s importovanými obrázky. Webové, desktopové i mobilní aplikace čtou stejný soubor. Terminálová aplikace zapisuje vlastní jednodušší zálohu, kterou tento formát nečte. **Export my data & render everything** vytvoří stejný soubor a druhý zip s každou uloženou relací vykreslenou do jejího výstupu. Úplný formát popisuje [Přenos dat](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Pokud vymažeš data prohlížeče

Ve webové aplikaci Lolly uchovává vše v úložišti prohlížeče pro tento web: uloženou práci, obrázky, písma, designové systémy, historii verzí a obsah stažený pro offline použití. Vymazání dat tohoto webu v prohlížeči to vše odstraní a Lolly z toho nemůže nic obnovit. Zůstane to, co už prohlížeč opustilo: stažené soubory, soubor **Export my data**, kopie [Sync](/info/sync.html) a sdílené odkazy.

::: warning Než vymažeš data prohlížeče
Stiskni **Export my data** v **Settings → Storage** a uchovej soubor jinde.
:::

Při spuštění aplikace Lolly požádá prohlížeč, aby její úložiště nevymazával, když na zařízení dochází místo, a prohlížeč rozhodne. V **Settings → Available offline** řádek začínající **Protected** znamená, že prohlížeč souhlasil. "Prohlížeč může vymazat stažený obsah, pokud na zařízení dochází místo" znamená, že nesouhlasil, a **Protect downloads** požádá znovu.

Pokud prohlížeč nesouhlasil, může při nedostatku místa vymazat uloženou práci i stažený obsah, takže si uchovávej aktuální soubor **Export my data**.

**Settings → Storage** ukazuje, kolik místa zabírá každý druh dat. Řádek **History** započítává automatické kontrolní body, jejich náhledy a koncepty pro obnovu. **Remove automatic checkpoints older than 30 days** uvolní toto místo a zachová uložené a pojmenované verze. **Clear cache** odstraní stažené soubory katalogu, které se podle potřeby stáhnou znovu. **Clear all my data** tě požádá o napsání slova, vypne Sync a pak odstraní vše, co Lolly v tomto prohlížeči uchovává: tvůj profil a nastavení, uložené relace s jejich historií a Trash, nahrané soubory, písma a designové systémy, záznam stažení, výsledky Convert, stažené modely AI a offline kopie. Soubory, které jsi stáhl, zůstanou tam, kam jsi je uložil. Aplikace se pak spustí jako při první návštěvě.

![Karta úložiště na obrazovce široké jako telefon: všechny kategorie dat v zařízení pojmenované, dole tlačítko Clear all my data](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

V desktopových a mobilních aplikacích jsou uložené relace soubory ve vlastní datové složce aplikace a vše ostatní je ve vlastním úložišti aplikace. Vymazání webového prohlížeče se jich nedotkne.

::: details Kde desktopové a mobilní aplikace uchovávají uložené relace
Jeden soubor pro každou uloženou relaci ve složce `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/` nebo stejná cesta pod `$XDG_DATA_HOME`
- iPhone, iPad a Android: ve vlastním úložišti aplikace, které aplikace Files nezobrazuje

Obrázky, designové systémy a seznam posledních stažení zůstávají v interním úložišti aplikace, ne v těchto složkách. Terminálová aplikace a příkazový řádek čtou stejnou složku `saved-state`: viz [Kde jsou uložené relace](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Vrať si něco, co jsi smazal

Smazání uložené relace, složky, některého z nahraných souborů nebo některého z tvých písem v aplikaci přesune položku na 30 dnů do **Trash**, ať ji smažeš kdekoli: v **Projects**, **Assets**, **Settings → Storage** nebo v seznamu uložených relací nástroje. Složka a vše v ní se přesune do Trash jako jedna položka. Relace si v Trash uchová historii verzí. Hned po smazání zpráva nabídne **Undo**. Později:

1. Otevři **Trash**: dlaždici **Trash** v **Projects**, tlačítko **Trash** v **Assets → Your uploads** nebo řádek **Trash** v **Settings → Storage**. Všechny tři otevřou stejný seznam.
2. Stiskni **Restore** vedle položky. Vrátí se do své složky a písmo získá zpět role, které mělo ve svém designovém systému.

**Delete forever** odstraní jednu položku natrvalo. **Empty Trash** se nejdřív zeptá a pak odstraní všechny položky v Trash. Položky starší než 30 dnů se odstraní natrvalo.

::: warning Některá smazání jsou okamžitá
Smazaný designový systém, logo ani profilová fotka nejdou do Trash. Příkazový řádek a terminálová aplikace také mažou ihned.
:::

Se zapnutým [Sync](/info/sync.html) může **Restore an earlier copy** obnovit stav celého zařízení z dřívějšího dne a soubor **Export my data** obnoví to, co obsahuje.
