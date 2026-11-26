# Zásady ochrany osobních údajů

*Poslední aktualizace: 10. listopadu 2026*

- <!--i:eti-home--> **Tvorba v Lolly probíhá na tvém zařízení.** Otevření nástroje, psaní, náhled, export i kontrola souboru běží v aplikaci na tvém telefonu, počítači nebo v prohlížeči. Nepotřebuješ účet a aplikace pro nic z toho nenastavuje cookies.
- <!--i:eti-globe--> **To, co vytvoříš, opustí tvé zařízení, jen když o to požádáš.** Přidání písma z Google Fonts, odeslání souboru na Drive nebo Dropbox, zapnutí Sync, přehrávání rádia nebo stažení modelu AI pro běh na zařízení vždy vyvolá požadavek, který jsi spustil. Aplikace také stahuje své nástroje a aktualizace z vlastní adresy a tyto požadavky neobsahují nic z toho, co jsi vytvořil. [Všechny síťové požadavky, které aplikace může odeslat](#every-network-request-the-app-can-make), je uvádějí podle jednotlivých hostitelů.
- <!--i:eti-cpu--> **Několik služeb Lolly běží na serveru.** Odkazy na vykreslení, služba načítání obrázků, koncový bod pro agenty AI a služba ověřené identity dostávají jen to, co jim pošleš, a neuchovávají to déle, než uvádí tato stránka.
- <!--i:eti-building--> **Instance Lolly Work tvé organizace funguje jinak.** Uchovává sdílenou práci, kterou tam uložíš, a záznam tvých přihlášení a činností. Na tato data se vztahují zásady jejího provozovatele, nikoli tyto zásady.

Pokud se chceš zeptat na svá data nebo uplatnit svá práva, viz [Tvá práva](#your-rights) a [Kdo je odpovědný](#who-is-responsible-and-how-to-reach-us).

::: figure privacy-where-data-goes
Kam putují tvá data: zůstávají na tvém zařízení, dokud nespustíš požadavek, a každý druh požadavku má vlastní cíl.
:::

<!--i:eti-clipboard-->
## Na co se tyto zásady vztahují

Lolly je software s otevřeným zdrojovým kódem, který může provozovat kdokoli: engine, aplikace pro web, počítač, mobil a terminál a rozšíření prohlížeče. Tyto zásady mají dvě části:

- <!--i:code--> **Samotný software**: co s tvými daty dělá a nedělá, ať běží kdekoli. Jde o vlastnost kódu, takže to platí pro každé nasazení Lolly, naše i kohokoli jiného.
- <!--i:server--> **lolly.tools**, referenční nasazení provozované SUSE: rozhodnutí při provozu jeho volitelných serverových částí, například co se zaznamenává, jak dlouho a kým.

V samostatně hostované nebo podnikové instanci Lolly stále platí níže popsané chování softwaru, ale za vše na jejích serverech odpovídá *provozovatel* dané instance, nikoli SUSE: za koncový bod vykreslování, server MCP, certifikační službu i instanci Lolly Work. Vyžádej si jeho vlastní zásady. [Zavedení & správa](/info/adoption-governance.html) popisuje, co provozování Lolly obnáší.

<!--i:eti-home-->
## Co zůstává na tvém zařízení

Webová, desktopová i mobilní aplikace Lolly spouštějí celý vykreslovací engine na zařízení. Jakmile jsou nástroje, assety a enkodéry, které používáš, na zařízení, vykreslování ani stahování nepotřebuje server.

**Používání samostatné aplikace nenastavuje žádné cookies.** Přihlášení do organizace a volitelná registrace ověřené identity mají vlastní cookies, popsané v příslušných sekcích. Aplikace na zařízení uchovává tyto záznamy:

- <!--i:sliders--> **Předvolby rozhraní**: motiv, jazyk, nastavení zvuku, nastavení přístupnosti, velikost postranního panelu a zvětšení, volby řazení a zobrazení a tipy, které jsi už viděl. Jsou v záznamu profilu a v `localStorage`, aby byly připravené ještě před dokončením spuštění aplikace.
- <!--i:usercheck--> **Údaje tvého profilu**: jméno, e-mailová adresa, telefonní číslo, pracovní pozice, organizace, město, země a portrétní fotka, které zadáš v **Settings**, v IndexedDB. Vyplňují nástroje, které je požadují, a do záznamu provenience exportu nebo sdíleného souboru `.lolly` se zapisují jen tehdy, když zapneš *Use my details*.
- <!--i:download--> **Offline mezipaměť katalogu nástrojů a náhledů assetů**, aby galerie fungovala bez připojení.
- <!--i:hash--> **Místní počítadla používání** pro statistiky na kartě profilu, například počet exportů a použité nástroje: malý záznam s omezenou velikostí v `localStorage`, který nikdy nečteme. Zařízení opouštějí jen v tvém vlastním záložním souboru nebo kopii Sync.
- <!--i:folder--> **Tvá vlastní práce**: dokumenty, uložené relace a jejich historie, nahrané obrázky a písma, výsledné soubory a dřívější verze a koš, který uchovává smazané položky 30 dní, pokud ho nevyprázdníš dřív. Po 30 dnech se položka odstraní při příštím otevření Projects, pokud ji stále nepoužívá uložená práce, jako tomu může být u obrázku nebo písma. Tyto záznamy jsou v IndexedDB a v soukromém souborovém úložišti prohlížeče (OPFS) na zařízení a zůstávají tam, pokud nezvolíš Sync nebo sdílení.
- <!--i:globe--> **Vyhledaná města v Meeting Planner**, v `localStorage`, aby se každé město vyhledávalo jen jednou.
- <!--i:cpu--> **Stažené modely a připnuté nástroje**: modely AI pro běh na zařízení, jejichž stažení jsi odsouhlasil, a nástroje připnuté pro offline použití.
- <!--i:seal--> **Tvá podpisová identita**, jakmile se zaregistruješ: trvalý pár klíčů, který podepisuje tvé Content Credentials, a jeho certifikát s tvou ověřenou e-mailovou adresou, v IndexedDB. Soukromý klíč nikdy neopustí zařízení. Bez registrace se klíč pro každý export vytvoří jen pro daný export a pak se zahodí; [Ověřená identita](#verified-identity-a-sign-in-you-start-yourself) vysvětluje obě možnosti.
- <!--i:link--> **Připojené služby**: přihlášení, hesla aplikací, klíče a přístupová fráze Sync, které se rozhodneš uchovat, štítky účtů zobrazené vedle nich a seznam **Links you've shared** s názvem a odkazem každého souboru. Nikdy nejsou v záloze ani v kopii Sync; [Soubory, které odesíláš](#files-you-send), popisují jednotlivé služby.

::: details Další záznamy, které aplikace uchovává na zařízení
- **Tvé odpovědi.** Na které jednorázové otázky jsi odpověděl a jak: přidání písma z Google Fonts, první požadavek každému agentovi v **Ask an agent**, **Allow pages from any site** a **Allow AI control**. Také která upozornění a uvítání jsi zavřel.
- **Nedávná aktivita.** Krátký seznam posledních stažených souborů, u každého název, nástroj, nastavení a miniatura pro Dashboard, a naposledy použité assety a nástroje.
- **Připojená instance.** Její adresa, ID instalace pro toto zařízení, záznam o tom, které místní kopie pocházejí z kterého pracovního prostoru, a kopie dat, která instance posílá aplikaci, v mezipaměti: její nastavení a jméno, e-mailová adresa, skupiny a role tvého účtu.
- **Pracovní soubory.** Rozpracované záznamy obrazovky, zvukové náhledy a kódovaná videa v OPFS a soubor, který s Lolly sdílí jiná aplikace, uchovávaný do příštího spuštění aplikace.
- **Stránky dokumentace.** lolly.tools/info nenastavuje cookies. Uchovává tvůj motiv, jazyk a pořadí jazyků v `localStorage`, čte nastavení Reduce motion a Large text z aplikace a pro návrat do aplikace uchovává adresu zobrazení aplikace, ze kterého tato karta prohlížeče přišla. Kopii dokumentace uchovává jen tehdy, když si ji stáhneš pro offline použití.
:::

**Settings → Storage** ukazuje, kolik místa Lolly na zařízení používá, a jednotlivě vypisuje tvou práci, koš, stažené modely, offline kopie a mezipaměti. **Clear all my data** odstraní místní kopii včetně service workerů Lolly a offline mezipamětí a nejdřív vypne Sync. Ponechá jen značku, která ostatním otevřeným kartám Lolly sdělí, že proběhlo vymazání. Neukončí přihlášení do organizace: tato cookie se odstraní při odhlášení nebo při vymazání dat webu v prohlížeči, které odstraní také vše, co toto tlačítko. Ukládání nezbytně nutné pro službu, o kterou jsi požádal, podle ePrivacy Directive (Art. 5(3)) nevyžaduje souhlas, pouze transparentnost, kterou zajišťují tento dokument a upozornění v aplikaci.

![Sekce úložiště v Settings na obrazovce o šířce telefonu: každá kategorie dat na zařízení je pojmenovaná a vedle seznamu je tlačítko Clear all my data](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** vytvoří soubor `lolly-backup`, který uchováváš a ovládáš ty. Na naše servery se nikdy nedostane, pokud ho sám někam nepošleš. Viz [Přenos dat](/info/data-transfer.html).

### Utility, které běží na tvém zařízení

Některé nástroje, například **Lolly Strip Hidden Data**, **Compress** a další s označením **Runs on your device**, pracují se souborem, který dodáš. Soubor se načte do paměti, transformuje na zařízení a nabídne zpět ke stažení. Nikdy se nenahrává, protože na této cestě není žádný server. Tyto utility fungují offline a jejich výstup nenese žádný náš vodoznak ani metadata.

**Lolly Rondocode** je jedinou výjimkou, protože z tvé skladby vytváří nový zvuk místo transformace tvého souboru. Každý zvukový soubor, který zapíše, obsahuje Content Credentials, které zaznamenávají skladbu a označují případný zpěv vygenerovaný AI. Panel Export to uvádí před exportem a [Skladby Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility) přesně vypisují, co se zaznamenává.

**Music generator** také vytváří nový zvuk. WAV nebo M4A, které z něj stáhneš, vždy obsahují Content Credentials uvádějící, že stopu vytvořil generátor hudby Lolly, a licenci hudby CC BY 4.0 s uvedením autorství *Hudba vytvořená pomocí Lolly (https://lolly.tools), CC BY 4.0*. Melodie, kterou z něj uložíš, zaznamenává jméno z tvého profilu jako autora, pokud profil obsahuje jméno, verze Lolly a enginu a tuto licenci. Vše se zobrazuje v podrobnostech melodie v Assets. Toto jméno zůstává ve tvé knihovně: export, který melodii přehrává, ho přidává jen se zapnutým *Use my details* a soubor stažený z generátoru hudby žádné jméno neobsahuje. [Co stopa zaznamenává](/info/generated-music.html#what-a-track-records) vypisuje jednotlivé záznamy.

![Označení těchto nástrojů: Runs on your device - nic se nenahrává](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** a **Lolly Compare** pracují v paměti na zařízení a nic neposílají na server. Prepare nic nepřidává do historie, odkazů, záloh ani Sync, dokud neuložíš výsledek.

<a id="how-prepare-for-sharing-and-compare-handle-your-files"></a>
::: details Jak Prepare for sharing a Lolly Compare nakládají s tvými soubory
**Prepare for sharing** uchovává pracovní vstupy, soukromá zjištění a mapy nahrazení v paměti a žádné přihlašovací údaje nekontroluje online. Sám volíš, zda výsledek zkopíruješ, stáhneš, odešleš nebo uložíš do knihovny; uložený výsledek se pak řídí nastavením zálohování a Sync tvé knihovny. Soubory receptů vynechávají dřívější obsah a mapování konkrétních hodnot a souhrnné zprávy obsahují počty, ID rozsahů a hashe souborů. CLI uloží soukromý soubor pro kontrolu s původními hodnotami jen na požádání pomocí `--review-file`. Opuštění zobrazení přípravy uvolní jeho pracovní stav, což není příslib forenzně neobnovitelného vymazání z paměti prohlížeče nebo operačního systému.

Připravené kopie a dokončené operace se soubory sdílejí ovládání Lolly Compare. Odstraněné hodnoty jsou zpočátku sbalené a zprávy o porovnání vynechávají názvy zdrojů, cesty a hodnoty, pokud je nezvolíš zahrnout. Historie souborů ukládá kopii, takže porovnání po opětovném načtení vyžaduje znovu vybrat originál, který se ověří podle zaznamenaného SHA-256. Jeho výběr soubor neuloží ani nenahraje.
:::

Lolly Strip Hidden Data a Prepare for sharing také na zařízení kontrolují soubory DOCX, PPTX a XLSX. U podporovaných souborů DOCX lze ve vzniklé kopii odstranit vybrané vlastnosti; ostatní obsah Office lze jen kontrolovat a soukromé náhledy zůstávají skryté za ovládacím prvkem pro odhalení.

::: details Co kontrola souborů Office čte a odstraňuje
| Formát Office | Kontrolovaný obsah balíčku | Podporované odstranění |
|---|---|---|
| DOCX | Základní, aplikační a vlastní vlastnosti; komentáře a autoři; značky a náhledy sledovaných změn; skryté úseky textu; externí vztahy; vložené objekty | Vybrané údaje o autorovi, posledním ukládajícím, datech vytvoření/změny/posledního tisku, názvu, předmětu, popisu, klíčových slovech, vlastní vlastnosti, Company, Manager, Template, základ hypertextových odkazů, název a verze aplikace a statistiky (celková doba úprav a počty stránek, slov, znaků, řádků a odstavců) |
| PPTX | Vlastnosti; komentáře a záznamy autorů; poznámky přednášejícího; značky skrytých snímků; externí vztahy; vložené objekty a podporované vnořené sešity | Žádné |
| XLSX | Vlastnosti; komentáře a poznámky; značky skrytých listů, řádků a sloupců; definované názvy; externí vztahy a připojení; části s externími odkazy a mezipaměťmi kontingenčních tabulek; vložené objekty | Žádné |

**Omezení.** Analýza nezkoumá úplně viditelný text, vzorce, závislosti, vykreslený vzhled ani libovolné binární části. Podporuje až 300 částí balíčku, celkovou deklarovanou velikost po rozbalení 64 MiB, 2 MiB na část XML a dvě úrovně vnoření vložených balíčků; Prepare sdílí limity počtu částí a rozbalené velikosti v rámci celé úlohy. Neúplný, chybně formátovaný, zašifrovaný a nepodporovaný obsah se nahlásí a ponechá. Obsah s makry se rozpozná a nikdy nespustí, starší binární formáty Office a XLSB se nekontrolují a externí odkazy se nikdy nenačítají.

**Co čištění DOCX ponechává.** Čištění podporuje formát balíčku Transitional DOCX s kanonickými částmi základních, vlastních a rozšířených vlastností. Z rozšířených vlastností lze odstranit Company, Manager, Template, HyperlinkBase, Application, AppVersion a statistiky TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines a Paragraphs. DocSecurity, názvy nadpisů a částí, příznaky odkazů a další vlastnosti aplikace se ponechávají. Odstranění Template ponechá v nastavení dokumentu případný odkaz na připojenou šablonu, kde ho analýza hlásí jako externí vztah.

Některé čtečky volí způsob vykreslení grafů a kreseb podle názvu a verze aplikace; LibreOffice například bez nich zobrazuje graf ze souboru Word 2007 jinak. Oba údaje se ponechávají, pokud soubor obsahuje grafy, obrázky, tvary nebo vložené objekty, a kontrola je uvádí jako ponechané. Vlastnost, kterou zobrazuje pole Word (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS nebo NUMCHARS), se ponechává a pole odkazů a relativní externí odkazy zachovávají HyperlinkBase, protože jejich cíle se vyhodnocují vůči této základní adrese.

**Co zůstává jen ke kontrole.** Rozšířené údaje o digitálním podpisu brání čištění. Podepsané, makry vybavené, zašifrované, chybně formátované, přejmenované nebo vnořené balíčky Office zůstávají jen ke kontrole. Totéž platí pro soubory s dalšími poli Word závislými na vlastnostech, například DOCPROPERTY nebo AUTHOR, nebo s ovládacími prvky obsahu navázanými na XML, protože odstranění vlastnosti by mohlo změnit dokument, až Word tyto vazby aktualizuje, a text polí v mezipaměti nemůže prokázat, že příští vykreslení bude vypadat stejně. Části XML s neobvyklými příponami souborů, cíle vztahů Word XML, které nelze bezpečně zkontrolovat, nesprávně deklarované části záhlaví nebo zápatí a části SVG deklarované jako XML s příponou `.svg` také v tomto prvním vydání čištění zůstávají jen ke kontrole.

**Jak čištění kontroluje svou práci.** Části vlastností, jejich deklarace, nesouvisející položky balíčku, komentáře XML a komentáře ZIP se ponechávají. Čištění uplatňuje limity analýzy a před zápisem kontroluje integritu každé položky, pak znovu zkontroluje výsledné vlastnosti. Lolly Compare zobrazuje podporované rozdíly vlastností se sbalenými hodnotami; neporovnává viditelný text ani vykreslený vzhled. Hodnoty používají náhledy o délce až 2048 znaků, takže rozdíly za hranicí náhledu nemusí být vidět a částečná kontrola nemůže prokázat shodu dvou souborů. Příkaz CLI `prepare --strip-hidden-data` odstraňuje podporované vlastnosti DOCX a soukromý soubor pro kontrolu může vybrat jednotlivé vlastnosti. Pokud ochranná kontrola čištění selže, soubor se ponechá a operace se ohlásí jako neúspěšná.
:::

<!--i:eti-globe-->
## Všechny síťové požadavky, které aplikace může odeslat

Většina požadavků přináší na tvé zařízení nástroje, písma nebo modely. Akce Send přenášejí vybraný soubor, Sync přenáší zálohu do zvoleného úložiště a služby organizace přenášejí obsah nebo údaje potřebné pro sdílenou práci. Každá skupina níže uvádí, co opouští tvé zařízení, kdy a co se stane, pokud provozovatel požadavek zablokuje. Poskytovatelé identity a assetů nakonfigurovaní provozovatelem mohou do daného nasazení přidat další cíle. [Všichni pevně daní hostitelé v jedné tabulce](#every-fixed-host-in-one-table) uvádějí hostitele, které může webová aplikace kontaktovat.

::: details Co se načítá do tvého zařízení
- <!--i:download--> **Katalog nástrojů.** Nic osobního: požadavek na vlastní veřejný index nástrojů a assetů Lolly, na vlastní adresu aplikace, při spuštění, poté uložený do offline mezipaměti. Při zablokování aplikace používá nástroje v mezipaměti a přestane objevovat nové.
- <!--i:sparkle--> **Sady emoji.** Vybraná sada se stáhne z vlastní adresy aplikace při prvním použití. Žádné osobní údaje se neposílají. Animace Lottie se čtou na zařízení a nikoho nekontaktují.
- <!--i:document--> **Google Fonts.** Název vybrané rodiny písem a tvá IP adresa putují na servery písem Google (`fonts.googleapis.com` pro šablonu stylů, `fonts.gstatic.com` pro soubor písma). Děje se to jen při přidání písma z Google Fonts v Lolly Design System Setup a až po tvém souhlasu v dialogu, který přesně toto uvádí. Každá rodina se načte jednou, pak zůstává na zařízení a používá se offline. Při zablokování výběr písma skončí bez načtení; místo toho nahraj soubor písma.
- <!--i:cpu--> **Modely AI pro běh na zařízení.** Nic osobního: stažení souboru modelu, který pak zůstává na zařízení. Webová sestavení ve výchozím stavu používají vlastní adresu aplikace; sestavení může určit jiného hostitele modelů, například hostitele vydání Lolly `lolli.li` pro balené aplikace. Hostitel dostane požadavek a tvou IP adresu, bez účtu a bez vstupů modelu. Děje se to jen při použití funkce, která potřebuje model (hloubková kontrola Lolly Verify, zvětšování obrázků, řeč a podobně), nebo když zvolíš stažení modelů pro offline použití. Při zablokování tato funkce čeká a vše ostatní funguje.
- <!--i:sliders--> **Tiskové profily ICC.** Nic osobního: požadavek na standardní profil tiskových podmínek do veřejného registru ICC (`registry.color.org`, `www.color.org`), jen když ve správci tiskových profilů klikneš na předvolbu ICC, jednou pro každý profil. Při zablokování předvolby nefungují; dodej vlastní profil `.icc`.
- <!--i:globe--> **Internetové rádio.** Nic osobního: požadavek na playlist a zvukový stream ze stanice (`api.somafm.com` a server streamu, na který odkazuje, `*.somafm.com`), jen když ve zvukovém přehrávači přehráváš volitelné rádio. Při zablokování rádio nefunguje a všechny ostatní zvukové funkce fungují dál.
:::

::: details Nástroj, který potřebuje aktuální data
- <!--i:globe--> **Vyhledávání měst v Meeting Planner.** V současnosti jde o jediný nástroj, který načítá aktuální data. Žádá `geocoding-api.open-meteo.com` o převod názvu každého města (města hostitele a města každého člena týmu) na souřadnice a časové pásmo, bez účtu, klíče a jiného identifikátoru než samotného požadavku. Vstup Host city to vysvětluje a každá odpověď se ukládá na zařízení, aby se město vyhledávalo jen jednou. Běží jen po dobu, kdy je nástroj otevřený. Při zablokování vyhledání selže a na nic jiného to nemá vliv.
:::

::: details Soubory, které odesíláš
Každá z těchto možností odesílá jen jeden vybraný soubor, když stiskneš její tlačítko Send, po přihlášení dokončeném ve vlastním okně dané služby. Heslo aplikace Bluesky, adresa webhooku Discord, heslo aplikace Nextcloud a klíče S3 se ukládají jen na tomto zařízení, nikdy do zálohy, a **Disconnect** je vymaže.

- <!--i:upload--> **Google Drive.** Soubor v libovolném formátu putuje do Drive API od Google (`www.googleapis.com`). Přístup Lolly je omezen na soubory, které vytvořila (rozsah oprávnění `drive.file`), takže nikdy nemůže číst zbytek tvého Drive. Ve webové aplikaci se přihlašovací token uchovává v paměti po dobu relace a nikdy se neukládá; v ostatních aplikacích se obnovovací token ukládá na tomto zařízení, jen pokud zaškrtneš **Stay connected**. Tlačítko existuje jen v sestaveních, kde provozovatel nakonfiguroval ID klienta Google. Při zablokování se tlačítko vůbec neobjeví; stáhni soubor a nahraj ho sám. **Odkazy pro sdílení.** Pokud stiskneš **Create a share link**, druhé volání na `www.googleapis.com` přidá souboru oprávnění (kdokoli s odkazem, tvá doména Workspace nebo adresy, které zadáš, přičemž jim Google pošle e-mail) a načte jeho odkaz. **Stop sharing** oprávnění odstraní. Nic dalšího není potřeba: rozsah `drive.file` už pokrývá soubory vytvořené Lolly.
- <!--i:upload--> **Dropbox.** Soubor putuje do API Dropbox (`api.dropboxapi.com` pro přihlášení a metadata, `content.dropboxapi.com` pro soubor). Přístup je omezen jen na složku aplikace, takže Lolly vidí `Apps/` a v ní svou vlastní složku a nic dalšího. Odkaz **Open**, který zobrazuje, je krátkodobý soukromý odkaz a žádné veřejné sdílení se nevytváří. Obnovovací token se ukládá, jen pokud zaškrtneš **Stay connected**. Tlačítko existuje jen s ID klienta Dropbox nakonfigurovaným provozovatelem. **Odkazy pro sdílení.** Teprve když poprvé stiskneš **Create a share link**, Dropbox tě požádá o schválení dalšího oprávnění, `sharing.write`. Lolly pak volá `api.dropboxapi.com` pro vytvoření odkazu (`sharing/create_shared_link_with_settings`) a při **Stop sharing** pro jeho zrušení. Odesílání souborů o toto oprávnění nikdy nežádá.
- <!--i:upload--> **OneDrive.** Soubor putuje do služeb identity a Graph od Microsoft (`login.microsoftonline.com` pro přihlášení, `graph.microsoft.com` pro nahrání); velký soubor se nahrává po částech na `api.onedrive.com` nebo na originy úložišť nakonfigurované provozovatelem. Přístup je omezen na vlastní složku Lolly pod `Apps/` a tvé zobrazované jméno pro štítek účtu. Obnovovací token se ukládá, jen pokud zaškrtneš **Stay connected**. Tlačítko existuje jen s ID klienta Microsoft nakonfigurovaným provozovatelem. **Odkazy pro sdílení.** **Create a share link** volá `graph.microsoft.com` (`createLink` na souboru) s přístupem, který jsi už udělil. Pokud ho Microsoft odmítne, Lolly nežádá o širší přístup: pošle tě na vlastní stránku souboru v OneDrive, kde použiješ jeho tlačítko Share. **Stop sharing** odstraní oprávnění odkazu.
- <!--i:upload--> **LinkedIn**, **jen v desktopových aplikacích**. Soubor s názvem jako textem příspěvku putuje na LinkedIn (`www.linkedin.com` pro přihlášení ve tvém vlastním prohlížeči, `api.linkedin.com` pro nahrání a příspěvek) jako veřejný příspěvek na tvém vlastním kanálu. Lolly může publikovat tvým jménem a číst tvé jméno pro štítek účtu, nic jiného. Přihlášení se uchovává, jen pokud zaškrtneš **Stay connected**, a tokeny LinkedIn platí 60 dní a nelze je obnovit bez tvého zásahu, takže přihlášení samo vyprší. Tito hostitelé nejsou v pravidlech připojení webové aplikace. Tlačítko existuje jen v sestaveních s nakonfigurovanou aplikací LinkedIn.
- <!--i:upload--> **Penpot.** Tvůj osobní přístupový token Penpot, který vložíš do aplikace, a archiv návrhu `.penpot` putují do API Penpot (`design.penpot.app`) přes malou předávací službu na vlastní adrese aplikace (`/api/penpot`), protože API Penpot neodpovídá přímo prohlížeči. Předávací služba údaje předá a zapomene; desktopové aplikace komunikují s Penpot přímo. Děje se to jen tehdy, když v nástroji Design stiskneš **Send to Penpot** a potvrdíš projekt. Při zablokování se odeslání neprovede; exportuj soubor `.penpot` a importuj ho sám.
- <!--i:upload--> **Bluesky.** Obrázek, jeho název jako text příspěvku a alternativní text a tvé uživatelské jméno a heslo aplikace (vytvořené v Bluesky → Settings → App passwords, nikdy heslo tvého účtu) putují na server Bluesky, který zadáš, tedy `bsky.social`, pokud nevybereš jiný. Účet nejdřív připojíš v **Settings → Connected services**.
- <!--i:upload--> **Discord.** Soubor putuje jako příloha na adresu webhooku kanálu, kterou jsi vložil, na discord.com. Kdokoli, kdo má adresu webhooku, může do tohoto kanálu publikovat, a proto zůstává na zařízení.
- <!--i:upload--> **Mastodon.** Soubor s názvem jako textem příspěvku putuje na server Mastodon nebo kompatibilní server, který zadáš, po přihlášení ve vlastním okně tohoto serveru. Připojení na serveru zaregistruje malou aplikaci pro toto zařízení a přihlášení se uchovává, jen pokud zaškrtneš **Stay connected**.
- <!--i:upload--> **Nextcloud nebo WebDAV.** Soubor putuje na tvůj vlastní server v jednom ověřeném nahrání s adresou serveru, uživatelským jménem a heslem aplikace, které jsi zadal (Nextcloud → Settings → Security → Devices & sessions; nikdy heslo tvého účtu). **Odkazy pro sdílení.** **Create a share link** provede jedno volání služby sdílení na tvém vlastním serveru (`/ocs/v2.php/apps/files_sharing/api/v1/shares`) se stejným heslem aplikace pro veřejný odkaz jen ke čtení s heslem a datem vypršení, které si zvolíš. **Stop sharing** toto sdílení odstraní.
- <!--i:upload--> **Úložiště kompatibilní s S3.** Soubor putuje do tvého vlastního bucketu (AWS S3, MinIO, R2, B2, Garage nebo libovolného koncového bodu SigV4), podepsaný na zařízení párem klíčů, který jsi zadal. **Odkazy pro sdílení.** Odkaz je předem podepsaná adresa vytvořená na tvém zařízení z uložených klíčů, takže její vytvoření nic neposílá. Platí nejvýše sedm dní a nelze ji vypnout dřív.

**Hostitele, které si zvolíš, musí schválit provozovatel.** Hostitelé Bluesky, Discord, Mastodon, Nextcloud a S3 nejsou v pevném seznamu Lolly, protože je vybíráš ty. Aplikace žádnému z nich nic nepošle, dokud provozovatel neschválí přesně daného hostitele HTTPS: na webu v Content Security Policy daného nasazení, v desktopových aplikacích při sestavení aplikace. Totéž platí pro vlastní úložiště a hostitele pro nahrávání do SharePoint. Na webu musí server také povolit volání z aplikace v prohlížeči (CORS) a přesměrování požadavek zastaví, takže použij adresu, která nepřesměrovává. Desktopové aplikace kontrolují každé přesměrování proti schválenému seznamu.

Tento seznam omezuje, které hostitele může aplikace kontaktovat. Nerozlišuje účty ani tenanty u Google nebo Microsoft a o povolených účtech a akcích rozhodují vlastní oprávnění poskytovatele. Nevztahuje se také na přihlašovací okna, jiné typy zdrojů ani nativní funkce, které mají vlastní pravidla. Změna vyžaduje nové desktopové sestavení nebo nové hlavičky webových odpovědí; před opětovným otevřením aplikace pro načtení změny ulož svou práci. [Originy konektorů](/info/connector-origins.html) popisují konfiguraci.
:::

::: details Sync mezi tvými zařízeními
- <!--i:folder--> **Co odchází.** Kopie toho, co jsi na tomto zařízení vytvořil (uložené relace a projekty, tvé designové systémy s jejich písmy a logy, nahrané obrázky, tvůj profil a předvolby), jako jeden soubor do jediného úložiště, které sis zvolil: složky aplikace Lolly ve tvém Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), souborů vytvořených Lolly v tvém Google Drive (`www.googleapis.com`), složky aplikace Lolly v tvém OneDrive (`graph.microsoft.com`, s většími soubory nahrávanými na `api.onedrive.com` nebo originy úložišť nakonfigurované provozovatelem a se stahováním z přesných originů úložišť nakonfigurovaných provozovatelem) nebo do tvého vlastního Nextcloud, serveru WebDAV či bucketu S3. Stejné úložiště uchovává až sedm denních kopií a jednu kopii z doby před posledním použitím změn.
- <!--i:shieldcheck--> **Nic neputuje do Lolly.** Na cestě není žádný server Lolly, přenosový server ani server Lolly Work a aplikace k tomu nepotřebují žádný web Lolly, ani pro přihlášení. Kopie se nejdřív zašifruje na zařízení, jen pokud nastavíš přístupovou frázi. Přihlášení, klíče, hesla aplikací, přístupová fráze a nastavení Sync zůstávají na zařízení a nikdy nejsou v kopii. Na webu si zapamatované připojení Google Drive uchovává jen štítek účtu, obvykle e-mailovou adresu tvého účtu Google, udělené oprávnění a čas připojení (a tvé vlastní ID klienta, pokud jsi ho zadal). Žádný přístupový token se neukládá a přihlášení Google trvá jednu návštěvu. V aplikaci pro Android probíhá přihlášení do Google Drive přes služby Google Play v telefonu, které provozuje Google.
- <!--i:sliders--> **Kdy.** Až poté, co zapneš **Sync across my devices** nebo stiskneš **Sync now**: nahrání krátce po každé změně a při opuštění aplikace a kontrola novější kopie při spuštění aplikace. Při zablokování Sync selže a uvede důvod a tvá práce zůstane na zařízení. Místo toho můžeš svá data exportovat do souboru a přesunout je sám. [Synchronizuj svá zařízení](/info/sync.html) popisuje tuto funkci.
:::

::: details Webové stránky, snímky a obrázky z jiných webů
- <!--i:monitor--> **URL, jejíž snímek chceš pořídit nástrojem.** Nástroj pro snímky URL požádá o přesnou adresu, kterou zadáš, jen když spustíš pořízení snímku. Protože adresu vybíráš v danou chvíli, není v pravidlech připojení a provozovatel ji nemůže povolit ani blokovat podle hostitele; pro odstranění této možnosti je nutné odstranit nástroj.
- <!--i:globe--> **Webová stránka v poli Lolly Design.** Stránka se spolu s tvou IP adresou vyžádá z webu, ze kterého pochází, stejně jako vše, co si vyžádá sama stránka. Pokud to prohlížeč podporuje, rámci se neposílají žádné cookies ani jiná adresa než vlastní origin aplikace, takže tvůj dokument ani jeho odkaz nikdy neputují s požadavkem. Ve webové aplikaci lze do rámce vložit jen tyto přehrávače: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (mapy) a `www.figma.com` a také referenční stránky na `wikipedia.org` a `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` a `www.openstreetmap.org`. **Allow pages from any site** pod **Settings → Trusted sites** znovu načte Lolly na tvém zařízení s pravidly umožňujícími vložit do rámce libovolnou stránku `https:` a stále platí stejná pravidla důvěry a dotazování. Stránka se načte jen pro web v tvých Trusted sites, včetně odstranitelných výchozích referenčních webů, nebo po schválení daného pole v jeho inspektoru; sada snímků, kterou ti někdo poslal, do té doby ukazuje obrázek každé stránky. Před prezentováním nabízí seznam pro každý web **Just this time** a **Always trust** a během prezentace se na nic neptá. Při zablokování pole zobrazí svůj obrázek s odkazem pro otevření stránky na nové kartě. Nástroje Lolly a ukázky Lolly Sandbox v poli běží na vlastní adrese aplikace a nikoho nekontaktují.
- <!--i:sliders--> **Změna zobrazované stránky.** Akce **Use page** u pole s webovou stránkou ti umožní odmítnout cookies nebo zavřít banner přímo na stránce. U přístupných stránek Lolly skryje **Hide cookie banners** známé překryvné prvky včetně OneTrust, aniž přijme cookies nebo změní volbu souhlasu na webu. **Page CSS** mění živou stránku daného pole i její prezentaci; exporty dál používají zvolený náhledový obrázek. Pravidla nemohou importovat zdroje ani písma a prohlížeče brání Lolly měnit CSS jiného webu. Náhledy Lolly Sandbox mají vlastní editor CSS pod **Edit in Sandbox**.
- <!--i:code--> **Webové zdroje ukázky Lolly Sandbox.** Každá šablona stylů, skript, písmo nebo obrázek, na který kód ukázky odkazuje, se vyžádá z webu, který ho hostuje, s tvou IP adresou a bez cookies; soubory uvedené v načtené šabloně stylů, například soubory písem Google Fonts, se počítají jako samostatné weby. Děje se to až po kliknutí na **Fetch & inline** nebo pro web v tvých Trusted sites; **Always trust** vedle souboru přidá jeho web do tohoto seznamu. Při zablokování ukázka běží bez těchto souborů a Lolly Sandbox vypíše každý soubor, který se nepodařilo načíst, a důvod.
- <!--i:download--> **Přidání obrázku z URL.** **Add from URL** ve výběru assetů nebo v Assets požádá o přesnou adresu obrázku, kterou vložíš. Vlastní pravidla webové aplikace brání prohlížeči načíst jiný web přímo, takže malá předávací služba na vlastní adrese aplikace (`/api/fetch-image`) načte obrázek a vrátí jen bajty; nic neukládá, adresu zapomene a odmítne vše, co není veřejnou adresou obrázku. Desktopové aplikace načítají adresu přímo. Vložený odkaz Lolly se vůbec nenačítá: vykreslí se na zařízení. Pokud provozovatel předávací službu vypne (`LOLLY_DISABLE_IMAGE_PROXY=1`), lze ve webové aplikaci přidávat jen odkazy Lolly, obrázky `data:` a obrázky ze stejného originu; desktopových aplikací se to netýká.
- <!--i:palette--> **Designový systém z webu.** Lolly Design System Setup může přečíst jednu stránku z webu, který zadáš, přes [rozšíření prohlížeče](#the-browser-extension) nebo vlastním načítáním desktopové aplikace, nikdy přes server Lolly. Před stisknutím se nic nenačítá a odkazy na stránce se nenásledují.
:::

::: details Práce s dalšími lidmi a agenty
- <!--i:link--> **Soukromá spolupráce.** Dvě zařízení se propojí přímo, bez serveru mezi nimi. Pozvánka a odpověď obsahují adresy, které každé zařízení vidí ve vlastní síti, a toto sestavení nemá nakonfigurovaný žádný externí server pro zjišťování adres, takže je poskytni jen člověku, se kterým pracuješ. Viz [Společná práce](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, v desktopové aplikaci. Dokud jsi viditelný, tedy deset minut po zahájení pozvánky ke spolupráci nebo, pokud to zapneš, kdykoli aplikace běží, aplikace v místní síti oznamuje náhodný název, tebou zvolené zobrazované jméno a druh zařízení. Neoznamuje e-mailovou adresu, účet ani trvalý identifikátor.
- <!--i:link--> **Invite an agent.** Stav dokumentu z pozvánky, náhledy požadované agentem, identita agenta a jeho úpravy putují přes nakonfigurovaný přenosový server pro živou spolupráci (`lolly.ing` na lolly.tools) k agentovi, kterého pozveš. Nainstalovaný hostovaný plugin také předává volání přes konektor lolly.tools na přenosový server určený pozvánkou; konektor mezi voláními neuchovává pozvánku ani dokument. Přenosový server drží pozvánky a čekající požadavky v paměti, dokud se neodpojíš nebo nevyprší jejich platnost: deset minut pro nepoužitou pozvánku a třicet minut bez aktivity pro pozvánku s připojeným účastníkem. Poskytovatel tvého agenta nakládá s přijatými daty podle vlastních zásad. Děje se to až poté, co vytvoříš pozvánku v Share a předáš její pokyny svému agentovi; přístup ke čtení umožňuje kontrolu a přístup k úpravám umožňuje i změny. Pause zastaví změny a Disconnect nebo odvolání pozvánky ukončí přístup. Při zablokování se agent nemůže připojit ani pokračovat a ty dál upravuješ.
- <!--i:cpu--> **Allow AI control**, v desktopové aplikaci. Agent běžící na tomto počítači může číst a upravovat otevřený dokument Lolly Design přes spojení, které zůstává v počítači. Funkce je vypnutá, dokud ji nezapneš. Lolly kvůli ní nic neposílá na server; poskytovatel agenta nakládá s tím, co agent přečte, podle vlastních zásad. [Model hrozeb & hranice důvěry](/info/threat-model.html) vypisuje, co takový agent může a nemůže dělat.
- <!--i:cpu--> **Ask an agent**, v desktopové aplikaci. Otevření **Ask an agent** v Lolly Design spustí v počítači hledání čtyř nástrojů agentů pro příkazovou řádku (Claude Code, Codex, Gemini CLI a GitHub Copilot CLI), sedmi aplikací (Claude, ChatGPT, Codex, Cursor, Visual Studio Code, LM Studio a Ollama) a serverů Ollama a LM Studio na `127.0.0.1`. Aplikace spustí příkazy pro verzi a nápovědu každého nástroje (a seznam funkcí Codex), přečte názvy a verze aplikací z jejich balíčků a zeptá se obou místních serverů, jaké modely obsahují. Nečte žádný soubor s přihlášením ani přihlašovacími údaji, výsledek zůstává v paměti aplikace a nic z něj se nikam neposílá. Když požádáš agenta, tvůj požadavek a otevřený dokument bez nahraných obrázků putují k poskytovateli tohoto agenta (Anthropic pro Claude Code, OpenAI pro Codex) pod účtem, ke kterému je nástroj přihlášený, a náklady se hradí z tvého tarifu u tohoto poskytovatele. Na cestě není žádný server Lolly. Před prvním požadavkem každému agentovi panel tyto informace zobrazí a jednou se zeptá; tvá odpověď se uchovává v `localStorage` na tomto zařízení. Agent běží bez nástrojů, v prázdné dočasné složce, jen s proměnnými prostředí potřebnými k nalezení vlastního přihlášení, takže klíče API nastavené v prostředí se nepředávají. Ve spravované instanci to zásady organizace mohou vypnout a aplikace pak agenty nehledá ani žádného nespouští.
- <!--i:server--> **Vzdálená instance.** Když aplikaci nasměruješ na jiné nasazení Lolly, dostává vše, co tato instance vrací, přes stejnou synchronizaci katalogu. Požadavky na ni navíc nesou značku verze (druh aplikace a verzi enginu, stejné informace, jaké obsahuje user agent), aby její provozovatel viděl, které verze Lolly se používají. Ve spravované instanci značka během přihlášení obsahuje také ID instalace pro toto zařízení, aby seznam zařízení provozovatele rozlišil jednotlivé instalace; odchod ID odstraní a zařízení, které se později znovu připojí, předloží nové. Hostitele vybíráš ty, takže není v pravidlech připojení. Při zablokování přepnutí selže a tvá místní instance zůstane nedotčená.
- <!--i:people--> **Instance Lolly Work tvé organizace.** Přihlašovací identita a informace o zařízení, požadavky na zásady, sdílené relace, úpravy při spolupráci, nahrané soubory, podklady ke schválení, stránky značky, které publikuješ, a soubory, které používáš k doručení, putují do instance tvé organizace, s přihlášením přes jejího poskytovatele identity. Aktualizace zásad mohou probíhat během používání; sdílená práce, spolupráce, kontrola a doručení posílají obsah jako součást těchto pracovních postupů. Vlastní aplikace Lolly neposílají instanci žádné události používání. Při zablokování nelze tyto funkce organizace dokončit a tvá osobní práce zůstává oddělená. Viz [Služby organizace s Lolly Work](#organisation-services-with-lolly-work).
:::

### Všichni pevně daní hostitelé v jedné tabulce

Content Security Policy webové aplikace brání skriptu kontaktovat hostitele, který v ní není uvedený. Kromě vlastní adresy aplikace tabulka uvádí všechny hostitele uvedené v těchto pravidlech a navíc dva hostitele LinkedIn, které přidávají desktopové aplikace, označené jako dostupné jen na desktopu. Test CI porovnává tuto tabulku s nasazenými pravidly, takže hostitele nelze přidat do jednoho bez přidání do druhého.

| Co | Co skutečně opouští tvé zařízení | Hostitelé |
|---|---|---|
| Modely pro běh na zařízení v balených aplikacích a soubory vydání | Požadavek na veřejný soubor s tvou IP adresou | `lolli.li` |
| Google Fonts | Název rodiny písem a tvá IP adresa | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Odesílání do Google Drive a synchronizace s ním | Vybraný soubor nebo záloha a oprávnění ke sdílení, když požádáš o odkaz pro sdílení | `www.googleapis.com` |
| Odesílání do Dropbox a synchronizace s ním | Vybraný soubor nebo záloha a nastavení odkazu, když požádáš o odkaz pro sdílení | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Odesílání do OneDrive a synchronizace s ním | Vybraný soubor nebo záloha, tvé zobrazované jméno pro štítek účtu a požadavek na odkaz, když požádáš o odkaz pro sdílení | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Vyhledávání měst v Meeting Planner | Název každého města | `geocoding-api.open-meteo.com` |
| Tiskové profily ICC | Požadavek na veřejný profil | `registry.color.org`, `www.color.org` |
| Internetové rádio | Požadavek na playlist a zvukový stream | `api.somafm.com`, `*.somafm.com` |
| Invite an agent a pracovní prostor lolly.ing | Stav dokumentu z pozvánky, náhledy a úpravy a požadavky, které zadáváš v pracovním prostoru | `lolly.ing` |
| Přehrávače ve webovém poli Lolly Design | Požadavek na stránku s tvou IP adresou | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Referenční stránky ve webovém poli Lolly Design | Požadavek na stránku s tvou IP adresou | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Odesílání na LinkedIn, jen v desktopových aplikacích | Soubor s názvem jako veřejným příspěvkem | `www.linkedin.com`, `api.linkedin.com` |

Vlastní seznam desktopových aplikací obsahuje také koncový bod tokenů Google pro přihlášení do Drive. Každý jiný hostitel, například server Mastodon nebo Nextcloud, který zadáš, potřebuje schválení provozovatele, jak popisuje sekce Soubory, které odesíláš. Hostitelé, které vybíráš až při použití, například URL pro pořízení snímku nebo vzdálená instance, kterou zadáš, nejsou v žádném seznamu.


**Podpisy SEAL neodesílají žádný požadavek.** Lolly Verify umí kontrolovat podpisy SEAL, schéma, jehož podpisový klíč lze publikovat v DNS. Prohlížeče nemohou posílat dotazy DNS, takže webové vyhledání by muselo projít přes resolver DNS-over-HTTPS třetí strany, který by viděl ověřovanou doménu a tvou IP adresu. Lolly dříve používala resolver Cloudflare; už ho nepoužívá a nic Cloudflare nenahradilo. Žádná aplikace Lolly dnes klíče SEAL nevyhledává: desktopové a mobilní aplikace používají stejné zobrazení Verify a příkaz `lolly validate` SEAL nekontroluje. Soubor, jehož záznam SEAL obsahuje klíč přímo, se kontroluje offline a Lolly Verify označí podpis za vnitřně konzistentní bez potvrzení domény. U souboru, jehož klíč je jen v DNS, se zobrazí **SEAL signature did not verify** s důvodem „chybí resolver klíčů a klíč není vložen přímo“.

![Obrazovka Lolly Verify: plocha pro přetažení souboru a nic dalšího - soubor se kontroluje tam, kde už je, bez nahrávání a bez účtu](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Toto i každé další tvrzení na této stránce si můžeš ověřit sám: [Ověř si to sám](/info/verify-yourself.html) uvádí příkazy a očekávaný výstup.

<!--i:eti-cpu-->
## Služby provozované na lolly.tools

Tyto služby běží na lolly.tools pro všechny. Každá dostává jen to, co jí pošleš. [Serverová rozhraní](/info/server-surface.html) popisují stejné komponenty tak, jak fungují v libovolném nasazení.

### Odkazy na vykreslení

Každá URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` skutečně vykresluje a její vstupy putují v URL, takže sdílený odkaz Lolly může v README, wiki nebo přehledu fungovat jako živý obrázek. Její načtení požádá server o vykreslení **veřejných dat nástrojů a katalogu** se vstupy zapsanými do adresy.

- <!--i:usercheck--> **Bez účtů, cookies a stavu.** Tato cesta nežádá o přihlášení a nic na tvém zařízení nečte. Tvé dokumenty, relace a nahrané soubory nikdy neopouštějí prohlížeč a v těchto odkazech se nemohou objevit.
- <!--i:document--> **Samotná URL se zaznamenává.** Řetězec dotazu URL je součástí požadavku, takže se objevuje v běžných přístupových protokolech hostingové platformy jako každá požadovaná cesta. Pokud vstupy odkazu obsahují něčí jméno nebo e-mailovou adresu, například u jmenovky nebo e-mailového podpisu, **tento text zůstává v těchto protokolech**. Odkazu na vykreslení předávej jen to, co bys umístil na veřejnou stránku.
- <!--i:globe--> **Vstupy jsou tak jako tak veřejné.** Jde o to, co autor odkazu zadal do URL, a přečíst si je může každý, ke komu se odkaz dostane. Pro citlivý obsah nabízí Lolly šifrování odkazů.
- <!--i:eyeoff--> **V mezipaměti, s omezením a bez indexování.** Odpovědi se ukládají do mezipaměti a mají omezenou četnost požadavků jako každý veřejný obrázek a jsou označené `noindex`, aby vyhledávače tvá vykreslení vynechaly.

Samostatně hostované nasazení, které nechce veřejnou cestu pro vykreslování, nastaví `LOLLY_DISABLE_RENDER_GET=1` a každá z těchto URL vrátí 404.

### Služba načítání obrázků a předávací služba Penpot

**Add from URL** ve webové aplikaci a **Send to Penpot** používají dvě malé předávací služby na lolly.tools, popsané v sekci [Všechny síťové požadavky, které aplikace může odeslat](#every-network-request-the-app-can-make). Služba načítání obrázků nic neuchovává a adresu zapomene. Předávací služba Penpot předá tvůj token a archiv do Penpot a ani jedno neuchovává; zaznamenává název příkazu a stav odpovědi Penpot.

### Server MCP pro agenty AI

Agent AI může přistupovat k Lolly přes Model Context Protocol prostřednictvím koncového bodu provozovaného provozovatelem. Jeden běží na lolly.tools a kdokoli může provozovat vlastní, i zcela offline.

- <!--i:cpu--> **Soubory, které agent posílá.** Nástroje přijímající soubor (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` a obrazové nástroje `lolly_look`, `lolly_sample_color` a `lolly_trace_edges`) ho zpracují v paměti a vrátí výsledek ve stejném volání. Soubor se nikdy nezapisuje na disk a po dokončení požadavku se neuchovává. `lolly_inspect` také přijímá soubor a jeho kontroly videa a tiskové produkce zapisují dočasnou pracovní kopii, která se po návratu volání smaže. Všechny ostatní nástroje pracují s parametry volání: textem, čísly, barvami, URL, ID assetů z katalogu nebo dokumentem dodaným volajícím.
- <!--i:cpu--> **Lolly Rebrand uvádí, kam sada snímků putuje.** První fáze `lolly_rebrand`, `capabilities`, slovně popisuje, kam by tvé bajty putovaly, ještě než nějaké pošleš: na vlastním místním serveru sada snímků nikdy neopustí daný počítač a na hostovaném serveru volání `lolly_rebrand` sadu snímků odešle tam, do limitu velikosti a počtu snímků, který tato fáze uvádí.
- <!--i:lock--> **Otevřený koncový bod.** Na lolly.tools je `lolly.tools/api/mcp` přístupný komukoli bez tokenu. Volání jsou omezena podle adresy a denním rozpočtem. Z adresy se v úložišti ochrany proti zneužití stane pseudonymní otisk, stejně jako u níže popsaných přihlašovacích koncových bodů, a rozpočet počítá jen čas CPU a odeslané bajty, bez adresy. Token bearer omezeného koncového bodu se nikdy nezapisuje do protokolu ani do URL vykreslení.
- <!--i:link--> **Odkazy ke stažení velkých výsledků.** lolly.tools vrací výsledky přímo v odpovědi a tyto odkazy nikdy nevydává. Provozovatel je může zapnout pro vlastní ověřovanou bránu, kde se výsledek uchovává nejvýše pět minut a stáhnout ho může jen vlastní token bearer volajícího; viz [Server MCP](/info/mcp.html#private-download-links-for-large-results). Plánovaný omezený koncový bod na `mcp.lolly.tools` by přijímal token bearer vydaný provozovatelem důvěryhodným klientům nebo OAuth 2.1 s krátkodobými podepsanými tokeny ověřovanými pomocí sdíleného tajemství; jeho aktivace zatím neproběhla a je uvedený v sekci [Hostitelé pro doručování a zpracovatelé](#delivery-hosts-and-processors).

### Ověřená identita: přihlášení, které spouštíš sám

Lolly může do tvých exportů vložit podepsaný **Content Credential**, aby kdokoli mohl offline ověřit, že se soubor od opuštění Lolly nezměnil. Tato část je **ve výchozím stavu zapnutá a zcela místní**: podpisový klíč vzniká na tvém zařízení a podepisování probíhá offline. Bez registrace je tento klíč jednorázový, nový pár klíčů se vytvoří pro každý export a poté se zahodí. Jakmile se zaregistruješ, klíč je trvalý a generuje se jako **neextrahovatelný**, takže ho nemůže přečíst ani vlastní kód Lolly, může ho jen požádat o podpis. V obou případech nikdy neopustí tvé zařízení.

[Export](/info/exporting.html#content-credentials-c2pa) vypisuje, co záznam obsahuje: nástroj, čas, obecný typ prostředí exportu, tvé jméno jen při zapnutém *Use my details*, díla s uvedeným autorstvím vložená do exportu, každou skladbu Lolly Rondocode, kterou video nebo zvukový export přehrává (její název, hash zdroje a způsob, jakým sandbox Lolly skladbu vykreslil), a každou uloženou melodii, kterou takový export přehrává (její název, hash receptu, verzi enginu a licenci, pokud ji melodie obsahuje). Autor uložené melodie, tedy jméno, se kterým byla melodie uložena, se přidává jen se zapnutým *Use my details*, takže při vypnutém přepínači ani touto cestou neopouští tvé zařízení žádné jméno. Panel exportu tyto skladby a melodie vypisuje před exportem a autora melodie zobrazuje, jen když se jméno zapíše.

Záznam a metadata souboru také obsahují [designový systém a colourway](/info/exporting.html#the-design-system-record), které export vykreslily: ID a název designového systému, jeho publikovanou verzi a colourway. Název designového systému je text zadaný jeho vlastníky a může obsahovat jméno klienta, takže karta **Design system** v panelu exportu ukazuje přesné znění ještě před exportem. Zruš zaškrtnutí karty nebo předej `_madewith=0` či `--no-madewith`, pokud je chceš vynechat.

Vydavatel designového systému může také zvolit zaznamenání adresy své [stránky značky](/info/brand-page.html#lead-back-from-your-files) do stejného záznamu. Adresa je jediným doplňkem. Nastavení je vypnuté, dokud ho vydavatel nezapne, a nepřenáší se s balíčkem ani kopií; stejná karta adresu zobrazuje a umožňuje ji vynechat. Zpětné čtení souboru tuto adresu nikdy nenačte: Lolly Verify zobrazí hostitele a ty rozhodneš, zda stránku otevřeš.

Soubor schválený přes Lolly Work organizace může obsahovat také podepsaný záznam o schválení: ID schválení, datum rozhodnutí a otisk kontrolovaného souboru, bez jmen, e-mailů, skupin, komentářů a názvů řetězců. Člověk žádající o kontrolu to vidí jako zaškrtnuté políčko a může jeho zaškrtnutí zrušit a organizace může zaznamenávání vypnout.

Soubor vytvořený ze [záměru](/info/visual-intent.html#what-goes-in-the-file) také zaznamenává, co měl splnit: účel, cílové prostředí, nástroj, jazyk a otisk požadavku. Příležitost, publikum, region a případný prompt jsou pouze otisky. Vlastní slova promptu se přidávají jen na žádost člověka nebo agenta, který vykreslení spouští, a běh to uvádí, protože si je může přečíst každý, ke komu se soubor dostane. Záznam lze vynechat a žádný jiný export ho neobsahuje.

Jediným *volitelným* krokem navíc je registrace ověřené identity, aby tvé exporty uváděly „Ověřeno - podepsal \<your email\>“ místo označení anonymního klíče. **Pokud registraci přeskočíš, certifikační služba od tebe nedostane žádné registrační údaje.**

![Karta Verified identity v Settings na šířku telefonu: výběr doby platnosti certifikátu a registrační krok pod ním, neaktivní, dokud ho sám nespustíš](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Pokud se zaregistruješ, stane se přesně toto:

::: timeline
- <!--i:usercheck--> **Vybereš způsob přihlášení**: GitHub, Google, SUSE (id.suse.com) nebo odkaz v e-mailu. U tří poskytovatelů OIDC přejdeš na vlastní přihlašovací stránku daného poskytovatele, pod jeho zásadami ochrany osobních údajů, nikoli našimi, a certifikační služba zpět dostane jen ověřenou e-mailovou adresu a název poskytovatele. U e-mailového odkazu putuje zadaná adresa do **Resend**, služby transakčních e-mailů, jen za účelem doručení tohoto jediného odkazu.
- <!--i:lock--> **Krátkodobá cookie chrání přesměrování.** Certifikační služba nastaví `lolly_ca_state`, `HttpOnly`, omezenou na `/api/ca`, s platností nejvýše deset minut. Obsahuje náhodnou hodnotu místo sledovacího identifikátoru, slouží jen k zabránění podvržení přihlašovacího přesměrování a smaže se hned po dokončení přihlášení.
- <!--i:eyeoff--> **Tvá IP adresa se krátce používá k prevenci zneužití** přihlašovacích koncových bodů, aby jeden skript nemohl zahltit schránku nebo vyčerpat kvótu e-mailů. Lolly ji převede na otisk SHA-256 ještě před předáním do krátkodobého úložiště ochrany proti zneužití, takže se tam neposílá původní adresa. Otisk je pseudonymní, nikoli anonymní: někdo s přístupem k úložišti by mohl obnovit adresu IPv4 vyzkoušením všech možných adres. Záznam pro omezení četnosti vyprší asi po minutě a k ničemu jinému se nepoužívá. Běžné přístupové protokoly hostingu jsou oddělené a popsané níže.
- <!--i:seal--> **Služba vydá certifikát**, který spojuje tvou ověřenou e-mailovou adresu s veřejným klíčem tvého zařízení. Soukromý klíč zůstává na zařízení: klient pošle žádost o certifikát s navázaným důkazem držení klíče a žádný soukromý klíč zařízení neputuje k vydavateli v žádném z režimů.
- <!--i:check--> **Podepisování zůstává místní.** U původního vydavatele export nepotřebuje žádný požadavek na certifikační službu. Spravovaná identita také potřebuje čerstvý podepsaný seznam odvolaných certifikátů od svého vydavatele; klient může použít seznam v mezipaměti v rámci nakonfigurovaného okna aktuálnosti a jeho obnovení může během exportu kontaktovat certifikační službu. Chybějící, prošlý nebo neplatný stav zabrání použití spravované identity.
:::

::: details Uchovávání a odvolání v jednotlivých režimech vydavatele
**Původní hostované vydávání** nabízí 7, 30, 90 nebo 365 dní, s horní hranicí stanovenou provozovatelem. Neuchovává evidenci identit ani protokol vydávání, takže nemůže zjistit, kdo získal certifikát, ani odvolat certifikáty daného člověka; odvolání nahrazuje omezená doba platnosti.

**Spravované vydávání organizace** používá výchozí dobu platnosti nejvýše 24 hodin a maximum sedm dní, s vlastními zásadami důvěry pro kořenovou autoritu a vydavatele, a podepisování probíhá u vydavatele Vault nakonfigurovaného provozovatelem. Jeho registrační aplikace používá sdílené úložiště jednorázových povolení vstupu, které uchovává jen autentizační identifikátor odvozený pomocí klíče a otisk požadavku, nejvýše deset minut, a neukládá evidenci identit ani mezipaměť certifikačních odpovědí. Poskytovatel PKI, jeho auditní zařízení, brány a zálohy mají vlastní datové toky. I při vypnutém běžném ukládání vydaných certifikátů může odvolání založené na certifikátu uchovat certifikát včetně jeho e-mailové identity a sériová čísla odvolání a auditní identifikátory mohou zůstat propojitelná; zásady tvého provozovatele určují tuto evidenci, kdo k ní má přístup a jak dlouho se uchovává.

Spravované zařízení může požádat o odvolání vlastního certifikátu s ověřeným důkazem identity zařízení a žádné API nežádá o soukromý klíč zařízení. Provozovatel může odebrat vydavatele prostřednictvím svých zásad důvěry. Lolly neuchovává mapování lidí na certifikáty, takže odvolání certifikátů člověka při jeho odchodu závisí na záznamech provozovatele a záznamy PKI, auditní záznamy, příjemci a zálohy se řídí zásadami provozovatele. [Návrh certifikační služby](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) popisuje správu klíčů vydavatele, uchovávání u poskytovatele a posouzení způsobilosti.
:::

<!--i:eti-building-->
## Služby organizace s Lolly Work

**Lolly Work** je volitelná služba projektu Lolly pro organizace, kterou každá organizace provozující instanci nasazuje samostatně. Připojení k instanci přidává vedle místních úprav data uchovávaná na tomto serveru. Její provozovatel odpovídá za zásady ochrany osobních údajů, řízení přístupu, příjemce, uchovávání a zálohy daného nasazení.

Když je připojený pracovní prostor, řádek o soukromí na první obrazovce aplikace to uvádí: pracovní prostor uchovává to, co uložíš do jeho projektů nebo přes něj sdílíš, a záznam tvých přihlášení a činností v něm.

| Pracovní postup | Data zpracovávaná službou organizace |
|---|---|
| Přihlášení a zřizování účtů | Tvrzení poskytovatele identity, účet a členství ve skupinách, přihlašovací relace a informace o zařízení. OIDC zajišťuje přihlášení; správci mohou zřizovat a deaktivovat účty přes SCIM |
| Sdílený katalog a projekty | Nahrané assety, metadata a verze; sdílené projekty a relace; stránky značky, které publikuješ; obsah načtený od nakonfigurovaných poskytovatelů knihoven |
| Spolupráce v Lolly Work | Stav sdílené relace, živé úpravy a přítomnost účastníků přenášené přes instanci; uložený stav přetrvává podle jejích zásad ukládání |
| Spravované odkazy pro sdílení | Cíl odkazu a nastavení přístupu, například vypršení platnosti a volitelná ochrana heslem; požadavky se vyřizují přes instanci a přístup lze odvolat |
| Kontrola a doručení | Odeslaný obsah, rozhodnutí o schválení, vybraný cíl, připravené soubory a potvrzení o doručení |
| Serverová vykreslení a dávky | Odeslané vstupy nástrojů, požadavky na vykreslení, stav a uchovávané výstupní soubory. Tyto úlohy běží na serveru místo na tvém zařízení |
| Přehledy používání | Povolené štítky událostí, například ID nástroje, formát a ID assetu, od klienta, který je odesílá, podle níže uvedených zásad telemetrie |
| Audit | Záznamy o aktérech a akcích u řízených operací, uchovávané odděleně od telemetrie používání |

Služba používá autentizační cookies, včetně `lw_session` pro přihlášené členy a `lw_guest` pro přístup hostů tam, kde je povolený, odděleně od cookie certifikační služby. Aktualizace zásad mohou během používání aplikace odesílat požadavky bez samostatného kliknutí pro každý z nich. Jde o komunikaci s nakonfigurovanou instancí, nikoli o hlášení projektu Lolly o nasazeních, která neprovozuje.

**Kontrola vydání.** Server Lolly Work jednou denně kontroluje publikovaný index chartů na GitHub kvůli novějšímu vydání, stejným prostým požadavkem jako jakékoli `helm repo update`, bez jakýchkoli údajů o instanci nebo jejích lidech. Ve výchozím stavu je zapnutá a správce instance ji může vypnout nebo nasměrovat na zrcadlo ([`updates`](/info/work-configuration.html#updates)).

**Telemetrie používání má tři úrovně.** Vlastní aplikace Lolly dnes neposílají žádné události používání, takže se tyto úrovně vztahují na události z jiného klienta, kterého provozovatel připojí. `off` neukládá žádné události používání, `aggregate` odstraňuje ID uživatelů a `standard` může události přiřazovat uživatelům. Výchozí úroveň je `standard`, takže instance ukládá události používání, které dostane, pokud provozovatel nezvolí `off`. Výchozí zásada přiřazování je `opt-in`, která před uložením ID uživatele vyžaduje tvůj souhlas; provozovatel může místo toho nastavit přehledy s přiřazením pomocí `telemetryAttribution: default`. Povolené atributy jsou štítky, nikdy hodnoty vstupů nástrojů. Viz [Telemetrie Lolly Work](/info/work-telemetry.html).

**Audit je oddělený.** Řízené akce mohou uchovávat auditní záznam s identifikací bez ohledu na tvůj souhlas s telemetrií. Vypnutí telemetrie nevypíná ukládání sdílených relací, záznamů o schválení, úloh vykreslování ani audit. Provozovatel řídí uchovávání a výmaz včetně případné pseudonymizace auditního protokolu; viz [Úložiště a životní cyklus dat Lolly Work](/info/work-data-lifecycle.html).

| | Tvé zařízení | Instance tvé organizace |
|---|---|---|
| Co uchovává | Tvou osobní práci, předvolby a mezipaměti | Sdílenou práci, účty, nahrané soubory, schválení, vykreslení, audit a nakonfigurovanou telemetrii |
| Kdo data maže | Ty, pomocí **Clear all my data** nebo dat webu v prohlížeči | Provozovatel prostřednictvím vlastních ovládacích prvků instance |
| Koho požádat | Nikoho: záznamy jsou na tvém zařízení | Provozovatele instance o přístup, export nebo výmaz |

::: warning Místní smazání není smazání na serveru
Odchod z instance nebo vymazání prohlížeče odstraní místní stav, nikoli uložené záznamy nebo zálohy organizace. Osobní [Sync](/info/sync.html) a **Export my data** zálohují tvé zařízení, nikoli službu organizace. Veřejná ukázka [lolly.work](https://lolly.work) uchovává svůj stav jen v paměti a není trvalým úložištěm tvé práce.
:::

<!--i:eti-camera-->
## Rozšíření prohlížeče

Rozšíření prohlížeče **Lolly URL Screenshot** pro nás neshromažďuje žádné osobní údaje. Nemá analytiku, sledování ani vlastní server. Stránka [Rozšíření prohlížeče](/info/extension.html) popisuje, jak funguje.

**Co dělá.** Webová aplikace Lolly ho může požádat o snímek webové stránky nebo o obsah stránky pro založení designového systému z webu. Každý požadavek otevře v rozšíření schvalovací okno, které ukáže žádající web, zda chce snímek nebo obsah stránky, a adresu stránky. Teprve po stisknutí **Approve once** rozšíření otevře danou stránku v dočasné kartě na pozadí, pořídí snímek nebo přečte stránku, předá výsledek kartě Lolly, která o něj požádala, a dočasnou kartu zavře. Pro snímek SVG také na této kartě přečte rozvržení stránky, její obrázky a soubory písem a aplikace je na tvém zařízení převede na tvary. Každý požadavek potřebuje vlastní schválení.

**Data.**

- <!--i:shieldcheck--> **Nic neshromažďujeme.** Výsledek putuje jen na stránku Lolly, která o něj požádala, ve stejném prohlížeči. Rozšíření neukládá obsah stránek a nepřidává dalšího příjemce.
- <!--i:globe--> **Síťové požadavky.** Schválená stránka se načte jako na kterékoli kartě spolu se vším, co si sama vyžádá. Čtení obsahu stránky také zevnitř stránky načte její šablony stylů a několik obrázků ikon a log a tato načítání neposílají cookies jiným webům. Snímek SVG znovu požádá stránku o soubory písem, které načetla, což tvůj prohlížeč obvykle obslouží z mezipaměti. Rozšíření nevytváří žádné další požadavky a žádný neputuje na server Lolly.
- <!--i:lock--> **Tvá relace prohlížeče.** Stránka se načte s tvou relací prohlížeče, jako kdybys ji otevřel sám, takže stránka, ke které jsi přihlášený, může do výsledku vložit soukromé informace.
- <!--i:link--> **Adresy, které schválíš**, se používají jen k načtení jedné stránky pro daný požadavek. Nezaznamenávají se ani nesdílejí.

**Oprávnění.**

- <!--i:wrench--> **`debugger`**: pro pořízení snímku přes DevTools Protocol, stejný mechanismus, který používá desktopová aplikace Lolly, a pro průchod stránkou v dočasné kartě při tvorbě SVG.
- <!--i:monitor--> **`tabs`**: pro otevření a zavření dočasné karty a pro kontrolu, že stránka Lolly ani cílová stránka od schválení nepřešly na jinou adresu.
- <!--i:code--> **`scripting`**: pro čtení obsahu stránky v dočasné kartě po schválení daného požadavku.
- <!--i:database--> **`storage`**: pro zapsání ID dočasných karet do úložiště relace, aby se zavřely i v případě, že prohlížeč během požadavku zastaví rozšíření. Žádný obsah stránek se neukládá.
- <!--i:check--> **Volitelný přístup k webům (`http://*/*`, `https://*/*`)**: při instalaci se neuděluje. Když stiskneš **Approve once**, rozšíření požádá Chrome o přístup k jedinému webu v daném požadavku a Chrome se tě u každého webu poprvé zeptá. I web, který jsi dříve povolil, stále potřebuje nové schválení pro každý požadavek.

Žádné z těchto oprávnění se nepoužívá ke čtení, sledování ani přenosu tvého prohlížení nad rámec jediného požadavku, který jsi schválil.

<!--i:eti-map-pin-->
## Hostitelé pro doručování a zpracovatelé

Veřejné soubory katalogu, nástroje a verze pro zobrazení ve výchozím stavu pocházejí z vlastní adresy aplikace. Názvy odvozené z obsahu mění místo, odkud se soubor načítá, nikoli příjemce požadavku. Tato funkce doručování neaktivuje žádnou CDN třetí strany. CDN, která ukončuje TLS, by dostávala podrobnosti požadavků včetně IP adres a všech cookies nebo přihlašovacích údajů bearer, které jsou jí předány, i pod stejným názvem hostitele v prohlížeči, takže provozovatel, který ji přidá, zapojuje nového zpracovatele.

**Před přidáním jakékoli CDN nebo externího hostitele modelů** musí správce zveřejnit název zpracovatele, název hostitele, jurisdikce, přijímaná metadata, dobu uchovávání a podmínky předávání. [Nasazení doručování](/info/deploy-delivery.html) vypisuje, co zveřejnit. Odpovědi soukromého pracovního prostoru obcházejí sdílené mezipaměti: osobní výsledky, odmítnutí přístupu a chyby používají `private, no-store` a povolenou soukromou odpověď lze znovu ověřit v tvém prohlížeči, aniž se stane veřejnou.

Referenční služby používají níže uvedený hosting. Jde o seznam názvů hostitelů, nikoli o tvrzení, že instance jiné organizace používá stejný region.

| Název hostitele nebo služba | Funkce a příjemce | Region a nakládání s daty |
|---|---|---|
| lolly.tools | Veřejná aplikace, katalog, vykreslování a certifikační služby; hosting UpCloud | Frankfurt, Německo. Podrobnosti požadavků se mohou objevit v protokolech infrastruktury; běžné místní úpravy zůstávají na zařízení |
| lolly.ing | Spravovaný pracovní prostor a služby agentů pro dokumenty; hosting UpCloud | Frankfurt, Německo. Soukromá databáze a souborové úložiště jsou na stejném hostiteli. Účty, sdílený obsah a záznamy služeb se řídí zásadami správce instance |
| mcp.lolly.tools | Plánovaná volitelná ověřovaná brána MCP a soukromé stahování výsledků; hosting UpCloud | Frankfurt, Německo, se stejným zpracovatelem hostingu. Aktivace zatím neproběhla. Brána by dostávala podrobnosti požadavků a parametry nebo soubory odeslané volajícím |
| lolli.li | Veřejné soubory vydání a modelů; UpCloud Managed Object Storage, oddělené od aplikačního clusteru | Frankfurt, Německo, v regionu objektového úložiště UpCloud europe-2. Stažení odesílá podrobnosti požadavku, nikoli vstupy, které model později zpracovává |
| Nakonfigurovaný poskytovatel identity | Google, GitHub nebo poskytovatel OIDC provozovatele | Přihlášení se řídí zásadami daného poskytovatele. Na název hostitele, region a podmínky předávání se zeptej provozovatele instance |
| Nakonfigurovaný poskytovatel assetů | Brandfolder nebo jiná knihovna zvolená provozovatelem | Poskytovatel dostává povolené požadavky na knihovnu. Přístup řídí oprávnění zdroje a zásady instance; na názvy hostitelů a regiony se zeptej provozovatele |
| Registrace e-mailem, pokud je nakonfigurovaná | Resend doručuje vyžádaný přihlašovací odkaz | Dostává cílovou e-mailovou adresu pro danou zprávu; platí jeho vlastní podmínky zpracování |

Referenční aplikace nepoužívá žádného jiného poskytovatele hostingu, databáze ani ochrany proti zneužití. Provozovatel může pro jinou instanci zvolit jiné poskytovatele a poskytovatele hostingu, identity, assetů i e-mailu je nutné zveřejnit každého zvlášť. [Region objektového úložiště](https://upcloud.com/docs/products/managed-object-storage/availability/) hostitele modelů se ověřuje odděleně od regionu aplikace.

**Volitelné odkazy MCP ke stažení vázané na ověřený subjekt.** Provozovatel může zapnout odkazy ke stažení velkých výsledků na ověřované bráně s jedinou replikou. Ve výchozím stavu jsou vypnuté. Anonymní brána na `lolly.tools/api/mcp` vrací výsledky přímo v odpovědi a tyto odkazy nikdy nevydává. Plánovaný omezený název hostitele je `mcp.lolly.tools`, u stejného zpracovatele UpCloud ve Frankfurtu; aktivace zatím neproběhla a tato stránka netvrdí, že služba odkazů ke stažení je v provozu. Odkazy nepřidávají žádnou CDN třetí strany.

::: details Jak se uchovávají odkazy MCP ke stažení u provozovatele
Odkaz může dostat jen ověřený volající s rozsahem oprávnění pro soubory a k jeho načtení je nutný token bearer téhož volajícího: použij ověřený token bearer z volání vykreslení, nikoli jiný token pro stejný účet. Oprávnění vyprší nejpozději za 300 sekund. Vlastnictví a vyhledávání výsledků zůstávají v paměti brány a výstupní bajty putují do soukromých dočasných souborů, které se promazávají po vypršení platnosti nebo odstraňují při řádném vypnutí. Restart brány zneplatní existující odkazy. Uchovávané výsledky jsou omezeny na 64 MiB na token bearer, 256 MiB pro celou bránu a 200 čekajících nebo uchovávaných souborů. Denní rozpočty CPU a dekódovaných bajtů započítávají výsledky při uchování i při stažení. Odpovědi používají `private, no-store` a `Referrer-Policy: no-referrer`. Samotný token odkazu neumožní jinému člověku nebo agentovi výsledek přečíst.
:::

<!--i:eti-file-->
## Protokoly infrastruktury

Tato sekce popisuje veřejné nasazení lolly.tools. Jeho hostingová platforma zaznamenává běžné podrobnosti požadavků: IP adresu, požadovanou cestu, časové razítko a user agent. Místní úpravy se k tomuto hostiteli nedostanou. Řetězec dotazu odkazu na vykreslení může obsahovat text dodaný volajícím, jak je vysvětleno výše. Souborové nástroje MCP zpracovávají dodané bajty v paměti. Instance Lolly Work také uchovává výše popsané záznamy podle zásad protokolování svého provozovatele.

**Veřejné služby omezují aplikační protokolování na minimum.** Server MCP zaznamenává spuštění, konfiguraci a varování při vykreslování; nevede vlastní protokol požadavků a nezaznamenává tokeny ani adresy volajících. Předávací služba Penpot zaznamenává název každého příkazu a stav odpovědi Penpot, nikdy hlavičky, tokeny ani soubor. Certifikační služba zaznamenává nastavení při spuštění a konfigurační varování a při selhání dva řádky zbavené podrobností: stavový kód neúspěšného odeslání bez adresy příjemce a pevný řádek o selhání bez textu chyby, výpisu zásobníku nebo URL, protože chyba poskytovatele může obsahovat údaje o identitě nebo přihlašovací údaje. Vše ostatní v protokolu pochází z hostingové platformy.

U lolly.tools řídí protokolování požadavků, rotaci a uchovávání na UpCloud správce instance. Tato stránka neuvádí neověřenou maximální dobu uchovávání protokolů. Pro aktuální harmonogram a s jakýmkoli požadavkem ohledně protokolů uchovávaných na serveru kontaktuj správce osobních údajů uvedeného níže. U jiné instance platí nastavení jejího provozovatele včetně případných exportů protokolů nebo dalších zpracovatelů.

<!--i:eti-stamp-->
## Právní základy, uchovávání a příjemci

Tato tabulka se vztahuje na referenční nasazení **lolly.tools**. Neuvádí právní základy ani doby uchovávání instance Lolly Work tvé organizace; ty uvádí její provozovatel ve vlastních zásadách.

| Zpracování | Právní základ (GDPR Art. 6) | Doba uchovávání |
|---|---|---|
| Vše na tvém zařízení (dokumenty, předvolby, mezipaměť, počítadla) | **Vůbec nejde o naše zpracování**: nikdy se to k nám nedostane. Ukládání na tvém zařízení je nezbytně nutné pro službu, o kterou jsi požádal (ePrivacy Art. 5(3)), takže nevyžaduje souhlas | Dokud to nesmažeš |
| Tvá e-mailová adresa během původní hostované registrace Content Credentials | **Art. 6(1)(b)**, plnění služby, o kterou jsi výslovně požádal | Původní služba nevede evidenci identit ani protokol vydávání; e-mail se používá během požadavku a je zahrnutý v certifikátu. Uchovávání v rámci spravované PKI organizace, auditu a odvolání se řídí zásadami jejího provozovatele |
| Pseudonymní otisk SHA-256 vytvořený z tvé IP adresy pro omezení četnosti požadavků na přihlašovací koncové body a veřejné koncové body vykreslování, obrázků a MCP | **Art. 6(1)(f)**, náš oprávněný zájem na prevenci zneužití bezplatné služby a e-mailové kvóty třetí strany. Podle našeho posouzení to splňuje balanční test, protože původní adresa se neposílá omezovači, otisk se používá jen k ochraně proti zneužití a sám vyprší | Asi jednu minutu v úložišti ochrany proti zneužití; poté se neuchovává |
| Přístupové protokoly hostingu (IP, cesta, časové razítko, user agent) | **Art. 6(1)(f)**, náš oprávněný zájem na zabezpečení služby, prevenci zneužití a diagnostice poruch | Rotace a uchovávání nastavené správcem; pro aktuální harmonogram kontaktuj správce osobních údajů |

**Příjemci.** Kategoriemi příjemců jsou náš poskytovatel hostingu (UpCloud), který hostuje databázi aplikace a úložiště ochrany proti zneužití, a jen při použití přihlášení e-mailem poskytovatel transakčních e-mailů (Resend). Úložiště ochrany proti zneužití dostává jen krátkodobé otisky, nikdy původní IP adresu. Pokud se přihlašuješ přes GitHub, Google nebo SUSE (id.suse.com), jednáš s daným poskytovatelem přímo podle jeho vlastních zásad ochrany osobních údajů a on nám sdělí ověřenou e-mailovou adresu a nic dalšího. Osobní údaje s nikým jiným nesdílíme a data neprodáváme, neprovozujeme reklamu ani neprofilujeme uživatele.

**Předávání mimo EHP.** Hosting, databáze a souborové úložiště referenční aplikace jsou ve Frankfurtu. Volitelní poskytovatelé identity, e-mailu a assetů mají vlastní místa a podmínky zpracování, které mohou zahrnovat přístup mimo EHP, a samotný region serveru neurčuje jurisdikci každého příjemce. Platné smlouvy s poskytovateli a podmínky předávání si vyžádej od správce osobních údajů; u jiné instance se zeptej jejího provozovatele. [Standardní smluvní doložky](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) Evropské komise jsou jednou z dostupných záruk pro takové předávání; tato stránka netvrdí, že je používá neověřená smlouva s poskytovatelem.

**Automatizované rozhodování.** Žádné. Neprobíhá profilování ani automatizované rozhodování s právními nebo obdobně významnými účinky (Art. 22).

<!--i:eti-smile-->
## Soukromí dětí

Běžné místní používání aplikace neposílá na lolly.tools žádný osobní obsah. Její volitelná registrace Content Credentials přijímá e-mailovou adresu a není zaměřená na děti ani pro ně určená. Služby organizací mají vlastní účty a nakládání s daty podle zásad svého provozovatele.

<!--i:eti-user-check-->
## Tvá práva

K záznamům uloženým jen na tvém zařízení můžeš sám přistupovat, opravovat je, mazat a přesouvat. Jsou v úložišti tvého prohlížeče nebo aplikace, v podobě, kterou můžeš kontrolovat, exportovat (**Export my data**, výše) nebo smazat (**Clear all my data** nebo data webu v prohlížeči).

Formálně máš podle GDPR Articles 15-22 právo na **přístup** ke svým osobním údajům, na jejich **opravu**, **výmaz**, **omezení** zpracování nebo **vznesení námitky proti** zpracování (včetně všeho, co zakládáme na oprávněných zájmech), na **přenositelnost údajů** a tam, kde se zpracování opírá o souhlas, na **odvolání souhlasu kdykoli**, aniž to ovlivní zákonnost toho, co proběhlo před odvoláním souhlasu.

Veřejná certifikační služba nevede protokol vydávání. Protokoly infrastruktury mohou obsahovat podrobnosti požadavků, takže tyto zásady neslibují, že hostingové prostředí neuchovává žádné osobní údaje. S žádostí o přístup, výmaz nebo jiným požadavkem ohledně těchto záznamů kontaktuj správce osobních údajů; vysvětlíme, jaké záznamy existují a co lze udělat. Ohledně práce, identit, telemetrie a auditních záznamů uchovávaných organizací kontaktuj svého provozovatele Lolly Work, protože místní ovládání exportu a mazání na tyto kopie nedosáhne.

**Máš právo podat stížnost.** Pokud se domníváš, že jsme s tvými údaji nakládali nesprávně, můžeš podat stížnost u dozorového úřadu pro ochranu osobních údajů: v EU u úřadu v zemi tvého bydliště, pracoviště nebo místa, kde podle tebe došlo k porušení (Art. 77). Naším vedoucím dozorovým úřadem je *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) v německém Ansbachu. Nemusíš nejdřív kontaktovat nás, i když bychom uvítali možnost problém napravit.

<!--i:eti-history-->
## Změny těchto zásad

Datum nahoře se mění při každé změně tohoto dokumentu. Změna toho, co opouští tvé zařízení nebo co se uchovává, zde dostane vlastní řádek místo tiché úpravy. Chceš-li zjistit, co se změnilo, zeptej se (níže) nebo porovnej s [veřejným zdrojovým textem](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

::: details Dřívější změny, 29. září až 23. října 2026
**29. září 2026:** upřesněna volitelná služba lolly.work, její obsah uchovávaný organizací, autentizační cookies, telemetrie používání a auditní záznamy a oddělení místního mazání od uchovávání na serveru. Jde o existující volitelné pracovní postupy, nikoli o nový požadavek na nahrávání při místních úpravách.

**11. října 2026:** popis zrušeného hostingu Vercel nahrazen soupisem názvů hostitelů aplikace na UpCloud, odlišeni volitelní poskytovatelé identity a assetů a popsáno doručování podle adres odvozených z obsahu a režim stahování uchovávaných výsledků MCP. Tato změna nezapíná žádnou CDN třetí strany. Uchovávání protokolů řídí správce, nikoli uvedená výchozí hodnota tarifu Vercel.

**22. října 2026:** opraven popis existujícího chování. Sekce rozšíření prohlížeče nyní popisuje schvalovací okno pro každý požadavek, žádosti o přístup vždy k jednomu webu a načítání šablon stylů a ikon při čtení webu. Dále opraveny řádky Send to Google Drive a Meeting Planner, poznámka o SEAL (žádná aplikace Lolly nevyhledává klíče SEAL v DNS), výchozí úroveň telemetrie používání služby organizace, obrazové nástroje MCP a aplikační protokolování veřejných služeb. Samotný software se nezměnil.

**23. října 2026:** zásady přeorganizovány podle toho, co spouští jednotlivé požadavky, a doplněn popis existujícího chování, které dříve nepokrývaly: soukromé pozvánky ke spolupráci obsahující adresy místní sítě, Nearby v desktopové aplikaci, Allow AI control, čtení designového systému z webu, sady emoji, mezipaměť vyhledaných měst Meeting Planner na zařízení, koš a další záznamy vypisované v Settings → Storage. Opravena dvě tvrzení: Bluesky a Discord nejsou jen pro desktop a každý hostitel, kterého člověk zvolí pro odesílání, potřebuje schválení provozovatele ve webové i desktopové aplikaci; otisk IP adresy pro omezení četnosti požadavků je pseudonymní, nikoli anonymní. Samotný software se nezměnil.
:::

**3. listopadu 2026:** přidány odkazy pro sdílení po Send. Když stiskneš Create a share link, Lolly provede jedno další volání poskytovatele, kterému jsi odeslal soubor (Google Drive, Dropbox, OneDrive nebo tvůj vlastní Nextcloud), a Stop sharing provede další volání pro vypnutí odkazu. Odkaz pro sdílení S3 vzniká na tvém zařízení a nic neposílá. Nezapojuje se žádný nový hostitel a Lolly na serveru neuchovává kopii žádného odkazu ani tokenu.

**3. listopadu 2026:** přidáno **Ask an agent** v desktopové aplikaci: co aplikace hledá v počítači při otevření panelu a co putuje k poskytovateli agenta, když ho požádáš, pod tvým vlastním účtem u tohoto poskytovatele.

**10. listopadu 2026:** dokončen a opraven popis existujícího chování. Seznam dat na zařízení nyní uvádí údaje tvého profilu, tvou podpisovou identitu, uchovávaná přihlášení a sdílené odkazy, tvé odpovědi na jednorázové otázky, nedávná stažení, záznamy připojené instance, pracovní soubory v souborovém úložišti prohlížeče a to, co uchovávají stránky dokumentace. Opraveno: místní počítadla používání putují v tvém vlastním záložním souboru a kopii Sync; Clear all my data neukončuje přihlášení do organizace; koš odstraní položky starší než 30 dní při příštím otevření Projects; zapamatované připojení Google Drive na webu je označené e-mailovou adresou tvého účtu Google; vlastní aplikace Lolly neposílají instanci Lolly Work žádné události používání. Popsán také řádek o soukromí pracovního prostoru přidaný ve verzi 1.2.0 a stránky značky publikované do instance. Kromě tohoto řádku o soukromí se samotný software nezměnil.

**10. listopadu 2026:** přidána kontrola vydání Lolly Work: server Lolly Work jednou denně čte publikovaný index chartů, aby své správce informoval o novějším vydání. Požadavek neobsahuje nic o instanci ani jejích lidech a správce ho může vypnout nebo nasměrovat na zrcadlo.

<!--i:eti-mail-->
## Kdo je odpovědný a jak nás kontaktovat

**Správcem osobních údajů** pro lolly.tools je:

> SUSE Software Solutions Germany GmbH
>
> Frankenstraße 146
>
> 90461 Nürnberg
>
> Německo

SUSE jmenovala **pověřence pro ochranu osobních údajů**, kterého lze kontaktovat na [privacy@suse.com](mailto:privacy@suse.com). Tuto adresu použij pro jakoukoli formální žádost podle sekce „Tvá práva“ výše.

S čímkoli ohledně samotné Lolly, například jak funguje, proč je něco tak, jak je, nebo s opravou tohoto dokumentu, se obrať na **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

U samostatně hostované nebo podnikové instance Lolly kontaktuj jejího provozovatele: provozovatel je správcem osobních údajů pro vlastní nasazení. SUSE ani projekt Lolly s otevřeným zdrojovým kódem neuchovávají data nasazení, která neprovozují.
