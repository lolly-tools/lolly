# Najdi a obnov svou práci

Něco chybí: návrh, který jsi nikdy neuložil, soubor, který jsi stáhl, loňská verze, nebo všechno po vymazání prohlížeče. Začni tabulkou a pak sleduj sekci, na kterou ukazuje.

Osobní práce zůstává v prohlížeči nebo aplikaci, kde vznikla, na tom zařízení, pokud nezapneš [Sync](/info/sync.html). Organizace používající volitelné Lolly Work také drží **Team projects** na svém serveru, viz níže.

| Co jsi udělal/a | Kam se podívat |
|---|---|
| Stiskl/a jsi **Uložit jako** nebo **Uložit** | **Projekty** |
| Stiskl/a jsi **Stáhnout** | Stažené soubory tvého prohlížeče, a kopie v **Assetech** |
| Nic z toho, v [nástroji, který ukládá za chodu](#which-tools-save-as-you-work) | **Projekty** a **Historie** |
| Nic z toho, v nástroji, který neukládá | Jen karta, ve které jsi pracoval/a, dokud ji nezavřeš |
| Smazal/a jsi to v aplikaci | **Koš**, v **Projektech**, **Assetech** nebo **Nastavení → Úložiště**, na 30 dní |

::: figure find-your-work-places
Kde žije tvá práce: úložiště samotného prohlížeče drží Projects, History a Trash; stahování jde do složek tvého zařízení; Sync a záložní soubor jsou kopie mimo prohlížeč.
:::

::: details Najdi sdílenou práci v Lolly Work (volitelné)
Otevři Lolly své organizace a přihlas se, pak se podívej do **Projects → Team projects**. Sdílené relace drží ta instance a zobrazují se podle tvého přístupu. Přihlášení může obnovit přístup k těm relacím na jiném zařízení; neobnoví tvou osobní knihovnu ani zálohu zařízení.

V [pracovní kolaboraci](/info/collaborate.html#work-collabs-with-lolly-work-optional) počkej na **Saved to work**, než odejdeš. Pokud sdílený projekt chybí, zkontroluj, že jsi připojen ke správné instanci, a zeptej se jejího provozovatele na přístup nebo uchovávání. Vymazání dat prohlížeče odstraní místní kopie, ne kopii organizace na serveru. Viz [Používej Lolly ve své organizaci](/info/organisation.html).
:::

## Najdi něco, co jsi uložil/a

1. Stiskni **Domů** vlevo nahoře v nástroji.
2. Otevři kartu **Projekty** nahoře na domovské obrazovce (na mobilu ikona složky).
3. Podívej se na první obrazovku. Je tam práce uložená do **Moje knihovna** a každý projekt je tam složka. Chceš-li prohledat všechny složky najednou, napiš něco do pole **Hledat ve všech projektech…** dole na obrazovce.

Položka se jmenuje podle názvu souboru, který jsi napsal do panelu exportu, nebo podle svého nástroje, například **QR Code**, pokud jsi nic nenapsal. Otevři položku a každé nastavení je zpět, připravené ke změně a dalšímu exportu. Chceš-li novou práci uchovávat takto, viz [Ukládání a pokračování](/info/using.html#saving-continuing).

::: note Není to v Projektech?
- Možná je to v **Koši**: viz [Získej zpět něco, co jsi smazal/a](#get-back-something-you-deleted).
- Jiný prohlížeč, anonymní okno nebo jiné zařízení začínají prázdné, pokud nepoužíváš [Synchronizaci](/info/sync.html) nebo [nepřesouváš svou práci](#move-your-work-to-another-device).
- Pokud jsi stiskl/a jen **Stáhnout**, viz [Najdi stažený soubor](#find-a-file-you-downloaded).
:::

::: details Práce s Projekty
Projekty můžeš také otevřít z **Nastavení → Úložiště → Uložené relace → Organizuj v projektech**. Fungují jako správce souborů:

![Projekty předtím, než se cokoli uloží: dlaždice Nová složka, Nový prvek a Šablony, hodiny History vpravo nahoře a lišta Hledat ve všech projektech dole](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Vnořené složky.** Seskupuj uložené relace do složek a složky do složek, tak hluboko, jak chceš. Vytvoř složku, přejmenuj ji nebo přetáhni dlaždici na jinou složku, abys ji přesunul; drobečková navigace tě vrátí nahoru. Relace uložené bez složky se objeví přímo v kořeni **Projects**.
- <!--i:clock--> **Řaď po svém.** **View options**, tlačítko s posuvníky vpravo nahoře, nabízí **Grid** nebo **List** a řadí podle **Name**, **Date added**, **Last modified** (výchozí), **Size** a, uvnitř složky, **By tool**. Složky jdou vždy první bez ohledu na aktivní řazení - řazení uspořádává jen relace a složky uvnitř jejich vlastní skupiny.
- <!--i:document--> **Zakládej novou práci rovnou.** **New asset** otevře sdílený výběr. Zvol **Templates**, abys začal z uložené šablony: otevři ji k úpravě nebo použij **+ Add** a ulož novou tvorbu hned.
- <!--i:checklist--> **Vícenásobný výběr (desktop).** Zaškrtni políčko dlaždice, táhni výběrový rámeček přes prázdné místo nebo **Shift/Cmd-klik**; **pravým tlačítkem** na dlaždici otevřeš její kontextovou nabídku. Lišta výběru pak nabízí **Render selection**, **Move to…**, **New folder**, **Delete** (přesune do Koše), **Edit together** pro dvě až osm relací jednoho nástroje vedle sebe pod jedním postranním panelem a **Edit as sheet**, které otevře výběr libovolné velikosti či směsi jako řádky v mřížce dávky.
- <!--i:download--> **Vykresli celou složku nebo výběr.** **Render folder** exportuje každou uloženou relaci ve složce - včetně podsložek - jako jeden vnořený `.zip`. **Render selection** totéž udělá pro jakýkoli vícenásobný výběr a jedna relace se vykreslí rovnou do vlastního souboru.
- <!--i:link--> **Skoč rovnou k uložené práci nástroje.** Zaškrtni jeden nebo více nástrojů v galerii Tools a zvol **View sessions** na liště výběru - Projects se otevře a ukáže jen relace vytvořené těmito nástroji, s **Clear** pro návrat k úplnému zobrazení.
- <!--i:link--> **Sdílej uloženou relaci.** Klikni pravým tlačítkem na relaci (na telefonu stiskni **•••** na její dlaždici) → **Share link** zkopíruje odkaz, který ji znovu otevře se stejným nastavením; obrázky z tvého zařízení s odkazem neputují (úplný dialog Share: viz [Sdílení práce](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Přejmenuj nebo zkopíruj.** Klikni pravým tlačítkem na relaci (na telefonu stiskni **•••** na její dlaždici) pro **Rename**, **Duplicate** (kopie ve stejné složce) a **Move to…**.

![Vyskakovací okno Možnosti zobrazení v Projektech: Rozvržení s Mřížkou a Seznamem a Řadit podle nastavené na Poslední úpravu, vedle tlačítka, které obrátí pořadí](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

## Když zavřeš kartu nebo opustíš nástroj

Co se vrátí, závisí na tom, jak jsi odešel/odešla a který nástroj jsi použil/a:

- **Zavřel jsi kartu nebo ses vrátil později.** Neuložená práce je pryč, kromě [nástrojů, které ukládají při práci](#which-tools-save-as-you-work): otevři tu práci z **Projects**.
- **Znovu jsi načetl stránku ve stejné kartě.** Tvá nastavení se vrátí z adresy stránky. V nástrojích, které neukládají při práci, se obrázky a soubory přidané z tvého zařízení a jednořádkový text delší než 150 znaků nevrátí, protože je adresa nedrží.
- **Stiskl jsi Home nebo tlačítko zpět vlevo nahoře.** Pokud jsi od posledního uložení, stažení nebo kopírování něco změnil, dialog **Unsaved edits** se zeptá, zda nejprve uložit. **Save & leave** uloží práci a odvede tě do **Projects** nebo zpět do složky projektu, odkud jsi práci otevřel. **Leave anyway** zahodí tvé změny: uložená položka se vrátí do podoby, jak jsi ji naposledy uložil, a tvorba, kterou jsi nikdy neuložil, opustí **Projects**. **Cancel** tě ponechá v nástroji.

Lolly se zeptá, jen když stiskneš **Domů** nebo tlačítko zpět v nástroji. Zavření karty, znovunačtení a vlastní tlačítko Zpět tvého prohlížeče se nikdy neptají. Pro jistotu stiskni **Uložit jako**, nebo **Uložit** v exportním panelu, než nástroj opustíš.

Když automatické obnovení není k dispozici, poznámka vedle editačních ovládacích prvků říká, co uchovat:

- V nástroji, který pracuje se souborem, který přineseš, ulož svá nastavení a ponech i původní soubory.
- V nahrávacím nástroji nebo utilitě bez akce Save ulož nebo stáhni výsledek, než odejdeš.
- Desktopové a mobilní aplikace řeknou, kdy je třeba uložit ručně.
- V soukromé kolaboraci drží dokument a jeho historii, včetně změn druhé osoby, ten, kdo pozval. Ten, kdo se připojil, pracuje na dočasné kopii a měl by uložit samostatnou kopii před koncem relace.

::: note Odešel/odešla jsi bez uložení omylem?
V nástrojích, které ukládají za chodu, uchovává Historie kopii zahozených úprav. Otevři stránku **Historie**, najdi je pod **Změny** a stiskni **Otevřít jako kopii**. V jiných nástrojích jsou změny pryč.
:::

::: details Které nástroje ukládají za chodu
Ve webové aplikaci ukládá za chodu každý nástroj, který vytváří dokument: Design, Chart, QR Code, Text, Sandbox a další. Tyto nástroje ne:

- nástroje, které pracují se souborem, který přineseš, jako Redact, Sign nebo Convert Image, protože Lolly nikdy nedrží kopii toho souboru;
- nástroje, které nahrávají z kamery, mikrofonu nebo obrazovky, jako Record, Screen Capture a Voice Recorder;
- nástroj, ve kterém není co měnit, jako Countdown.

V ostatních nástrojích tvá první změna založí práci v **Projects**, jako bys uložil, a pozdější změny se uchovávají při práci, jakmile nástroj dokončí vykreslení. Neuložená tvorba je v Projects stále po zavření karty a znovu se otevře s označenými neuloženými změnami.

**Leave anyway** stále zahodí ty změny a History uchovává kopii zahozených úprav 30 dní. Opětovné otevření nástroje z domovské obrazovky začne novou tvorbu; dřívější otevři z Projects.

3D a Darkroom ukládají při práci, ale neuchovávají soubor, který do nich načteš, například 3D model nebo LUT. History a **Save** uchovávají název, typ a velikost souboru, ne soubor. Když práci otevřeš znovu, poznámka říká, který soubor to byl, a nástroj funguje bez něj, dokud jej znovu nenačteš. Ponech si původní soubory.

Se zapnutou [Synchronizací](/info/sync.html) putuje takto založený výtvor na tvá další zařízení jako cokoli jiného v Projektech. Jeho verze zůstávají na zařízení, kde vznikly.

Pokud máš výtvor otevřený ve dvou kartách a uložíš v obou, zachová se poslední uložení. Práce, kterou nahradilo, není ztracená: je v Historii výtvoru pod **Chráněné koncepty**, s **Otevřít koncept jako kopii**.

Tohle funguje jen ve webové aplikaci, ne v desktopové nebo mobilní aplikaci, a ne když pracuješ naživo s někým jiným.
:::

## Najdi stažený soubor

V prohlížeči **Stáhnout** předá soubor tvému prohlížeči, který ho uloží do své složky stažených souborů (obvykle **Downloads**) nebo se zeptá kam. Lolly neví, kam soubor putoval, takže se podívej do seznamu stažených souborů svého prohlížeče.

Pokud se žádný soubor neobjevil, podívej se do exportního panelu, dokud jsi ještě v nástroji. Pod **Stáhnout** řádek uvádí název souboru a čas, s tlačítkem **Retry download**, a v Chrome, Edge a dalších prohlížečích na bázi Chromium i **Save file…** pro ruční výběr složky. Tenhle řádek a jeho soubor vydrží, dokud nástroj neopustíš, stránku znovu nenačteš nebo znovu neexportuješ.

Lolly si po každém stažení navíc uchová dvě věci:

- **Kopie souboru**, v **Assetech** pod **Tvoje nahrané soubory**, pokud je zapnuté **Ukládat mé výstupy do mé knihovny** pod **Nastavení → Tvoje rendery** (**Nastavení** jsou dole na domovské obrazovce). Toto nastavení je ve výchozím stavu zapnuté. Video, nebo soubor nad 50 MB, se nejdřív zeptá, a zip se nekopíruje.
- **Nastavení, které jsi použil/a**, pro tvých posledních 24 stažení. **Nedávné exporty**, pod tvojí uloženou prací v **Projektech**, znovu otevře nástroj s těmito nastaveními, abys mohl/a soubor udělat znovu, i když obrázky a soubory, které jsi přidal/a ze zařízení, nejsou zahrnuté. Stejný seznam je pod **Nastavení → Aktivita a statistiky → Poslední exporty** a na kartě **Changes** v **History**. Tento seznam uchovává nastavení, ne soubory.

::: details V desktopové a mobilní aplikaci
- **Desktopová aplikace:** **Stáhnout** uloží přímo do složky **Lolly** uvnitř tvé složky **Downloads**, bez dialogu. Řádek pod **Stáhnout** ukazuje, kam soubor putoval, například „Uloženo do Downloads/Lolly“, s tlačítkem **Zobrazit ve složce**. **Open Exports Folder**, v nabídce **Window** nebo **Exports**, otevře tuto složku kdykoli. Soubor se stejným názvem jako dřívější se uloží jako „název (1)“.
- **iPhone a iPad:** soubor se uloží v aplikaci **Soubory**, pod **Lolly**, a otevře se sdílecí panel, abys ho mohl/a poslat dál. Řádek pod **Stáhnout** ukazuje „Uloženo do Souborů → Lolly“.
- **Android:** otevře se nabídka sdílení, abys mohl/a vybrat, kam soubor půjde.

Na iPhonu, iPadu a Androidu nový soubor nahradí dřívější se stejným názvem.
:::

## Vrať se k dřívější verzi

- **Během této návštěvy:** **Zpět** krokuje zpátky přes tvých posledních 100 změn, dokud nástroj neopustíš nebo stránku znovu nenačteš. Viz [Zpět a znovu](/info/using.html#undo-and-redo).
- **V [nástrojích, které ukládají za chodu](#which-tools-save-as-you-work):** dřívější verze každého výtvoru se uchovávají. Postupuj podle kroků níže.
- **Všechno na zařízení:** se zapnutou [Synchronizací](/info/sync.html) **Restore an earlier copy**, pod **Nastavení → Připojené služby**, obnoví jednu z posledních sedmi denních kopií, nebo kopii z doby před tvým posledním použitím. Všechno na tomto zařízení pak odpovídá té kopii, ne jen jednomu návrhu.

Chceš-li otevřít dřívější verzi:

1. Stiskni **Historii**, tlačítko s hodinami vedle **Zpět** a **Znovu**. V Designu je **Historie** v horní liště; na mobilu stiskni **•••** a pak **Historie**. V nástrojích bez **Zpět**, jako Text a Sandbox, je **Historie** vedle **Domů** vlevo nahoře.
2. Najdi verzi podle data a času. Řádky **Automatický kontrolní bod** vznikají za chodu; řádky **Uložená verze** jsou chvíle, kdy jsi uložil/a.
3. Stiskni **Otevřít jako kopii**. Verze se otevře jako nový výtvor, a ten, který jsi měl/a otevřený, zůstane, jak byl. Kopie je v **Projektech**, s dovětkem „(copy)“ za názvem.

Chceš-li verzi zachovat pod názvem, stiskni **Name version**, napiš název a stiskni **Keep milestone**. Pojmenované verze jsou uvedené na stránce **History**, pod **Milestones**.

::: details Panel History a stránka History
Panel **History** navíc uvádí řádky **Recovered work**, a **Protected drafts** uchovává tvoje nejnovější úpravy mezi checkpointy, s **Open draft as a copy**. **Compare** a **Check assets** ti pomůžou rozhodnout se, než kopii otevřeš. Přepni **This creation** na **All history on this device**, abys viděl/a každý výtvor.

Automatické kontrolní body s časem řídnou: jeden za minutu za poslední hodinu, jeden za hodinu za poslední den, jeden za den po 30 dní, pak jeden týdně. Uložené verze i pojmenované verze se uchovávají všechny. Smazání výtvoru přesune do **Koše** i jeho verze, a **Smazat natrvalo** je odstraní.

Když se úložiště Historie zaplní, nejdřív se odstraní nejstarší automatické kontrolní body výtvorů, které jsi 30 dní neotevřel/a. Uložení zůstane zachované vždy, i tehdy: zapíše se jako aktuální práce, a Historie uvede, že se toto uložení neuchovává jako verze. **Nastavení → Úložiště** ukazuje, kolik Historie zabírá.

Stránka **History** (`#/history`) pokrývá každou tvorbu v tomto prohlížeči. Otevřeš ji tlačítkem hodin vpravo nahoře na domovské obrazovce nebo v **Projects**, volbou **Saved sessions** v nabídce profilu (na telefonu kulaté tlačítko loga vpravo nahoře) nebo stiskem **Open app history** v panelu History nástroje. Desktopové a mobilní aplikace stránku History nevedou, takže tam tlačítko hodin na domovské obrazovce a **Saved sessions** otevřou místo toho **Your recent work**: tvé nejnovější uložené relace a exporty s odkazem do Projects.

- **Nedávné** uvádí tvoje výtvory, od nejnovějšího, s tlačítkem **Pokračovat**.
- **Changes** dává checkpointy, stažení a výsledky Convert na jednu časovou osu. Stažení má **Reopen settings**.
- **Milestones** uvádí pojmenované verze.

Filtruj podle projektu, nástroje a data (na mobilu pod **Filters**). Stránka History nemá tlačítko pro smazání; k odstranění položky použij Projekty.
:::

## Přenes svou práci do jiného zařízení

| Co | Použij |
|---|---|
| Udržet zařízení v kroku | **Synchronizace mezi zařízeními**, pod **Nastavení → Připojené služby**: viz [Synchronizuj svá zařízení](/info/sync.html) |
| Přenést všechno najednou | **Exportovat moje data** a **Importovat data…**, níže |
| Předat jednu práci nebo jeden projekt | Soubor `.lolly`: **Export**, pak **Sdílet**, pak **Download .lolly**; pro celý projekt **Download project (.lolly)** v nabídce složky. Na druhém zařízení stiskni **Otevřít**. Viz [Soubor .lolly](/info/using.html#the-lolly-file) |

Odkaz ke sdílení nese tvá nastavení, ale ne obrázky nebo soubory, které jsi přidal/a ze zařízení.

::: note Import přidává a nic nemaže
Složky, oblíbené a šablony ze souboru se přidají vedle těch, které už jsou na druhém zařízení. Když je uložená položka na obou stranách, zachová se kopie uložená později. Tvoje údaje a nastavení na tom zařízení zůstanou, jaké jsou; prázdná pole se doplní ze souboru. **Přenést to do tohoto zařízení**, v Synchronizaci, funguje stejně.
:::

Chceš-li přenést všechno najednou:

1. Na starém zařízení otevři **Nastavení → Úložiště** a pod **Přesunout na jiné zařízení** stiskni **Exportovat moje data**. Lolly stáhne jeden soubor `.zip`, jehož název začíná na `LollyTools-`.
2. Přenes soubor přes USB, e-mailem sám/sama sobě, AirDropem nebo sdílenou složkou.
3. Na novém zařízení otevři **Nastavení → Úložiště**, stiskni **Importovat data…**, vyber soubor a stiskni **Import**.

::: note Co zůstane stranou
Přihlášení, klíče a synchronizační heslo zůstávají na každém zařízení. Seznam nedávných stažení, offline stažení a AI modely necestují žádnou cestou. Historie verzí cestuje jen v souboru **Exportovat moje data**, ne přes Synchronizaci nebo `.lolly`. Když je historie na jeden soubor příliš velká, nejstarší automatické kontrolní body se vynechají a řádek exportu uvede kolik. Kopii, kterou Synchronizace uchovává v tvém úložišti, lze stáhnout a otevřít, nebo ji vybrat v **Importovat data…**, jako záložní soubor; šifrovaná kopie se zeptá na tvoje heslo.
:::

::: details Co obsahuje záložní soubor
Soubor se jmenuje `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (části názvu pocházejí z tvého profilu a pokud nejsou nastavené, vynechají se; `<n>` je denní počítadlo, aby si exporty ze stejného dne nekolidovaly). Obsahuje tvůj profil, s tvými složkami, Košem, šablonami a oblíbenými; každou uloženou relaci s jejím náhledem; tvoje nahrané obrázky, písma, loga a kopie tvých stažení; tvoje design systémy; tvoje předvolby (motiv, šířku postranního panelu, lokální statistiky aktivity); uložené verze a výsledky z Convert; a z webové aplikace historii verzí tvých výtvorů.

Cache katalogu není zahrnuta - na novém zařízení se stáhne sama znovu. Každá část má kontrolní součet, takže soubor poškozený při přenosu se zachytí při importu, místo aby se obnovil napůl rozbitý. Uložené relace se automaticky znovu propojí s tvými importovanými obrázky. Webová, desktopová a mobilní aplikace čtou stejný soubor; terminálová aplikace zapisuje vlastní jednodušší zálohu, kterou tento formát nečte. **Export my data & render everything** vytvoří stejný soubor plus druhý zip s každou uloženou relací vykreslenou do jejího výstupu. (Úplná specifikace formátu: [Přenos dat](/info/data-transfer.html).)
:::

## Když vymažeš data prohlížeče

Ve webové aplikaci Lolly uchovává všechno v úložišti tvého prohlížeče pro tento web: uloženou práci, obrázky, písma, design systémy, historii verzí a offline stažení. Vymazání dat tohoto webu ve tvém prohlížeči odstraní to všechno a Lolly z toho nic nedokáže vrátit. Zůstane to, co už prohlížeč opustilo: soubory, které jsi stáhl/a, soubor **Exportovat moje data**, kopie [Synchronizace](/info/sync.html) a odkazy, které jsi sdílel/a.

::: warning Než vymažeš data prohlížeče
Stiskni **Exportovat moje data** pod **Nastavení → Úložiště** a ulož si soubor jinde.
:::

Při spuštění aplikace Lolly požádá prohlížeč, aby nemazal své úložiště, když zařízení dochází místo, a rozhodne prohlížeč. V **Settings → Available offline** řádek začínající **Protected** znamená, že prohlížeč souhlasil. "The browser may clear downloads if the device runs low on space" znamená, že ne, a **Protect downloads** se zeptá znovu.

Pokud prohlížeč nesouhlasil, může při nedostatku místa smazat uloženou práci stejně jako stažené soubory, takže si uchovej nedávný soubor **Export my data**.

**Nastavení → Úložiště** ukazuje, kolik místa zabírá každý druh dat. Jeho řádek **Historie** počítá automatické kontrolní body, jejich náhledy a obnovovací koncepty; **Odstranit automatické kontrolní body starší než 30 dní** uvolní to místo a zachová uložené i pojmenované verze. **Vymazat cache** zahodí stažené soubory katalogu, které se stáhnou znovu, až budou potřeba. **Vymazat všechna moje data** tě požádá o napsání slova, vypne Synchronizaci, a pak odstraní všechno, co Lolly uchovává v tomto prohlížeči: tvůj profil a nastavení, uložené relace s jejich historií a Koš, nahrané soubory, písma a design systémy, log stažení, výsledky Convert, stažené AI modely a offline kopie. Soubory, které jsi stáhl/a, zůstanou tam, kam jsi je uložil/a. Aplikace se pak spustí, jako při první návštěvě.

![Karta úložiště na obrazovce šířky telefonu: pojmenovaná každá kategorie dat na zařízení, s tlačítkem Clear all my data dole](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

V desktopové a mobilní aplikaci jsou uložené relace soubory ve vlastní datové složce aplikace a zbytek je ve vlastním úložišti aplikace, takže vymazání webového prohlížeče se jich netýká.

::: details Kde desktopová a mobilní aplikace uchovávají uložené relace
Jeden soubor na uloženou relaci, ve složce `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, nebo stejná cesta pod `$XDG_DATA_HOME`
- iPhone, iPad a Android: uvnitř vlastního úložiště aplikace, které aplikace Files nezobrazuje

Obrázky, design systémy a seznam nedávných stažení zůstávají ve vnitřním úložišti aplikace, ne v těchto složkách. Terminálová aplikace a příkazová řádka čtou stejnou složku `saved-state`: viz [Kde žijí uložené relace](/info/cli-reference.html#where-saved-sessions-live).
:::

## Získej zpět něco, co jsi smazal/a

Smazání uložené relace, složky, jednoho z tvých nahraných souborů nebo jednoho z tvých písem v aplikaci ji přesune do **Koše** na 30 dní, ať ji smažeš kdekoli: v **Projektech**, **Assetech**, **Nastavení → Úložiště** nebo v seznamu uložených relací nástroje. Složka jde i se vším, co obsahuje, jako jedna položka, a relace si po tu dobu uchovává svou historii verzí. Hned poté zpráva nabídne **Zpět**. Později:

1. Otevři **Koš**: dlaždici **Koš** v **Projektech**, tlačítko **Koš** v **Assetech → Tvoje nahrané soubory**, nebo řádek **Koš** v **Nastavení → Úložiště**. Všechny tři otevřou stejný seznam.
2. Stiskni **Obnovit** vedle položky. Vrátí se do své složky, a písmo získá zpět role, které mělo ve svém design systému.

**Smazat natrvalo** odstraní jednu položku navždy. **Vyprázdnit koš** se nejdřív zeptá, a pak odstraní všechny položky v Koši. Položky starší než 30 dní se odstraní navždy.

::: warning Některá mazání jsou okamžitá
Smazání design systému, loga nebo tvé profilové fotky nejde do Koše. Příkazová řádka a terminálová aplikace mažou také okamžitě.
:::

Se zapnutou [Synchronizací](/info/sync.html) může **Restore an earlier copy** obnovit stav celého zařízení z dřívějšího dne, a soubor **Exportovat moje data** obnoví to, co soubor obsahuje.
