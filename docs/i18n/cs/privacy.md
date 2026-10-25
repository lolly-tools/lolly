# Zásady ochrany osobních údajů

*Poslední aktualizace: 23. října 2026*

**Tvorba v Lolly probíhá na tvém zařízení.** Otevření nástroje, psaní, náhled, export i kontrola souboru běží v aplikaci na telefonu, počítači nebo v prohlížeči. Nepotřebuješ žádný účet a aplikace kvůli tomu nenastavuje žádné cookies.

**To, co vytvoříš, opustí tvé zařízení, jen když o to požádáš.** Přidání písma Google Font, odeslání souboru na Drive nebo Dropbox, zapnutí synchronizace, přehrávání rádia i stažení AI modelu do zařízení: každé z toho odešle požadavek, který jsi sám spustil. Aplikace také stahuje své nástroje a aktualizace z vlastní adresy a tyto požadavky nenesou nic z toho, co jsi vytvořil. [Každý síťový požadavek, který aplikace může odeslat](#every-network-request-the-app-can-make) je vypsán po jednotlivých hostitelích.

**Několik služeb Lolly běží na serveru.** Odkazy pro vykreslení, stahovač obrázků, koncový bod pro AI agenty a služba ověřené identity dostanou jen to, co jim pošleš, a uchovávají to nejdéle, jak tato stránka uvádí.

**Instance Lolly Work tvé organizace je jiná.** Ukládá sdílenou práci, kterou do ní vložíš, a na tato data se vztahují zásady jejího provozovatele, ne tyto.

::: figure privacy-where-data-goes
Kam putují tvá data: zůstávají na tvém zařízení, dokud nespustíš požadavek, a každý druh požadavku má svůj vlastní cíl.
:::

## Co tyto zásady pokrývají

Lolly je open-source software, který může provozovat kdokoli: engine, aplikační shelly pro web, desktop, mobil a terminál a rozšíření pro prohlížeč. Tyto zásady mají dvě části:

- <!--i:code--> **Samotný software**: co dělá a nedělá s tvými daty, ať běží kdekoli. Je to vlastnost kódu, takže platí pro každé nasazení Lolly, naše i cizí.
- <!--i:server--> **lolly.tools**, referenční nasazení, které provozuje SUSE: rozhodnutí učiněná při provozu jeho volitelných serverových součástí, například co se zaznamenává, jak dlouho a kdo to vidí.

V samostatně provozované nebo podnikové instanci Lolly platí chování softwaru popsané níže i nadále, ale za vše na jejích serverech odpovídá *provozovatel* této instance, ne SUSE: za jeho vykreslovací endpoint, MCP server, certifikační službu a instanci Lolly Work. Zeptej se ho na jeho vlastní zásady. [Adoption & Governance](/info/adoption-governance.html) popisuje, co provoz Lolly obnáší.

## Co zůstává na tvém zařízení

Webové, desktopové a mobilní aplikace Lolly spouštějí celý renderovací engine přímo na zařízení. Jakmile jsou nástroje, assety a enkodéry, které používáš, na zařízení, vykreslování a stahování žádný server nepotřebují.

**Používání samostatné aplikace nenastavuje žádné cookies.** Přihlášení do organizace a volitelné zapsání ověřené identity mají vlastní cookies, popsané v jejich sekcích. Aplikace uchovává na zařízení tyto záznamy:

- <!--i:sliders--> **Předvolby rozhraní**: motiv, jazyk, nastavení zvuku, velikosti postranních panelů a přiblížení, volby řazení a zobrazení a které tipy jsi už viděl, v `localStorage`, aby byly připravené dřív, než se aplikace dokončí spouštět.
- <!--i:download--> **Offline cache katalogu nástrojů a náhledů assetů**, aby galerie fungovala bez připojení.
- <!--i:hash--> **Místní počítadla používání** pro statistiky na tvé profilové kartě, například kolik exportů a které nástroje: malý omezený záznam v `localStorage`, který nikdy nečteme a nikam se neposílá.
- <!--i:folder--> **Tvá vlastní práce**: dokumenty, uložené relace a jejich historie, nahrané obrázky a písma, výsledky souborů a dřívější verze a Koš, který uchovává smazané položky 30 dní. Jsou v IndexedDB na zařízení a zůstávají tam, pokud nezvolíš synchronizaci nebo sdílení.
- <!--i:globe--> **Vyhledávání měst v Meeting Planneru** v `localStorage`, aby se každé město vyhledalo jen jednou.
- <!--i:cpu--> **Stažené modely a připnuté nástroje**: AI modely pro zařízení, jejichž stažení jsi odsouhlasil, a nástroje, které jsi připnul pro offline použití.

**Settings → Storage** ukazuje, kolik místa Lolly na zařízení zabírá, s tvou prací, Košem, staženými modely, offline kopiemi a cache vypsanými jednotlivě. **Clear all my data** tam odstraní místní kopii a nejprve vypne synchronizaci; vymazání úložiště webu v prohlížeči udělá totéž. Úložiště, které je přísně nezbytné pro službu, o kterou jsi požádal, nevyžaduje podle směrnice o e-soukromí (čl. 5 odst. 3) souhlas, jen transparentnost, kterou poskytuje tento dokument i upozornění v aplikaci.

![Sekce Úložiště v Nastavení na obrazovce šířky telefonu: pojmenovaná každá kategorie dat na zařízení, s tlačítkem Clear all my data vedle seznamu](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** vytvoří soubor `lolly-backup`, který si držíš a ovládáš ty. Nikdy se nedotkne našich serverů, pokud ho sám někam neodešleš. Viz [Přenos dat](/info/data-transfer.html).

### Utility, které běží na tvém zařízení

Některé nástroje, například **Strip Hidden Data**, **Compress** a další se štítkem **Runs on your device**, pracují se souborem, který zadáš. Soubor se načte do paměti, na zařízení se upraví a nabídne se ti zpět ke stažení. Nikdy se nenahrává, protože na cestě není žádný server. Tyto utility fungují offline a jejich výstup nenese žádný náš vodoznak ani metadata.

**Rondocode** je jediná výjimka, protože z tvé písně vytváří nový zvuk, místo aby upravoval tvůj soubor. Každý zvukový soubor, který zapíše, nese Content Credentials, jež zaznamenávají píseň a uvádějí případný zpěv generovaný AI. Panel Export to řekne před exportem a [Písně Rondocode](/info/rondocode.html#files-from-the-rondocode-utility) vypisuje přesně, co se zaznamenává.

![Štítek, který tyto nástroje nesou: Runs on your device - nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** a **Compare** pracují v paměti zařízení a nic neposílají na server a Prepare nic nepřidává do historie, odkazů, záloh ani synchronizace, dokud výsledek neuložíš.

::: details Jak Prepare for sharing a Compare zacházejí s tvými soubory
**Prepare for sharing** drží pracovní vstupy, soukromé nálezy a mapy nahrazení v paměti, bez přidání do historie, odkazů, záloh nebo synchronizace. Kontrola a nahrazení neposílají na server žádný obsah souborů a online nekontrolují žádné přihlašovací údaje. Ty rozhoduješ, zda výsledek zkopíruješ, stáhneš, odešleš, nebo uložíš do knihovny; uložený výsledek se pak řídí nastavením zálohy a synchronizace tvé knihovny. Soubory receptů vynechávají dřívější obsah a doslovná mapování a souhrnné zprávy obsahují počty, ID rozsahů a hashe souborů. CLI uloží soukromý soubor revize s původními hodnotami jen na požádání pomocí `--review-file`. Opuštěním zobrazení přípravy se uvolní jeho pracovní stav, což není příslib forenzního vymazání z paměti prohlížeče nebo operačního systému.

Připravené kopie a dokončené operace se soubory sdílejí ovládací prvky Compare. Odstraněné hodnoty začínají sbalené a zprávy o porovnání vynechávají názvy zdrojů, cesty a hodnoty, pokud je nezahrneš. Historie souborů ukládá kopii, takže porovnání po opětovném načtení znamená znovu vybrat originál, spárovaný podle zaznamenaného SHA-256. Jeho výběr soubor neukládá ani nenahrává.
:::

Strip Hidden Data a Prepare for sharing také kontrolují soubory DOCX, PPTX a XLSX na zařízení. U podporovaných souborů DOCX lze vybrané vlastnosti odstranit v nové kopii; ostatní obsah Office je jen ke kontrole a soukromé náhledy zůstávají za ovládacím prvkem odkrytí.

::: details Co kontrola Office čte a odstraňuje
| Formát Office | Kontrolovaný obsah balíčku | Podporované odstranění |
|---|---|---|
| DOCX | Základní, aplikační a vlastní vlastnosti; komentáře a autoři; značky sledovaných změn a náhledy; skryté textové úseky; externí vztahy; vložené objekty | Vybraný autor, naposledy uložil, data vytvoření/úpravy/posledního tisku, název, předmět, popis, klíčová slova, vlastní vlastnosti, Company, Manager, Template, základ hypertextových odkazů, název a verze aplikace a statistiky (celková doba úprav a počty stran, slov, znaků, řádků a odstavců) |
| PPTX | Vlastnosti; komentáře a záznamy o autorech; poznámky řečníka; značky skrytých snímků; externí vztahy; vložené objekty a podporované vnořené sešity | Žádné |
| XLSX | Vlastnosti; komentáře a poznámky; značky skrytých listů, řádků a sloupců; definované názvy; externí vztahy a připojení; povrchy externích odkazů a pivot cache; vložené objekty | Žádné |

**Limity.** Sčítání plně nekontroluje viditelný text, vzorce, závislosti, vykreslený vzhled ani libovolné binární části. Podporuje až 300 částí balíčku, 64 MiB celkového deklarovaného rozbalení, 2 MiB na část XML a dvě vnořené úrovně vložených balíčků; Prepare sdílí rozpočty částí a rozbalení v rámci celé úlohy. Zkrácený, poškozený, zašifrovaný a nepodporovaný obsah se nahlásí a ponechá. Obsah maker je rozpoznán a nikdy se nespouští, starší binární formáty Office a XLSB se nekontrolují a externí odkazy se nikdy nestahují.

**Co čištění DOCX ponechává.** Čištění podporuje přechodný formát balíčku DOCX s kanonickými částmi základních, vlastních a rozšířených vlastností. Z rozšířených vlastností lze odstranit Company, Manager, Template, HyperlinkBase, Application, AppVersion a statistiky TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines a Paragraphs. DocSecurity, nadpisy a názvy částí, příznaky odkazů a další vlastnosti aplikace se ponechají. Odstranění Template ponechá případný odkaz na připojenou šablonu v nastavení dokumentu, kde ho sčítání hlásí jako externí vztah.

Některé čtečky určují podle názvu a verze aplikace, jak vykreslit grafy a kresby; LibreOffice například zobrazí graf ze souboru Word 2007 bez nich jinak. Obojí se ponechá, když soubor obsahuje grafy, obrázky, tvary nebo vložené objekty, a kontrola je uvede jako ponechané. Vlastnost, kterou zobrazuje pole Wordu (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS nebo NUMCHARS), se ponechá a pole odkazů a relativní externí odkazy ponechávají HyperlinkBase, protože jejich cíle se vyhodnocují vůči této základní adrese.

**Co zůstává jen ke kontrole.** Rozšířená data digitálního podpisu čištění znemožňují. Podepsané, makra povolující, zašifrované, poškozené, přejmenované nebo vnořené balíčky Office zůstávají jen ke kontrole. Stejně tak soubory s dalšími poli Wordu závislými na vlastnostech, například DOCPROPERTY nebo AUTHOR, nebo s ovládacími prvky obsahu vázanými na XML, protože odstranění vlastnosti by mohlo dokument změnit, když Word tyto vazby aktualizuje, a text polí uložený v cache neukáže, že další vykreslení bude vypadat stejně. Části XML s neobvyklými příponami názvů souborů, cíle vztahů Word XML, které nelze bezpečně zkontrolovat, nesprávně deklarované části záhlaví nebo zápatí a části SVG deklarované jako XML s příponou `.svg` také zůstávají v tomto prvním vydání čištění jen ke kontrole.

**Jak čištění ověřuje svou práci.** Části vlastností, jejich deklarace, nesouvisející členy balíčku, komentáře XML a komentáře ZIP se ponechají. Čištění uplatňuje limity sčítání a před zápisem ověřuje integritu každého členu, poté výsledné vlastnosti znovu zkontroluje. Compare ukazuje podporované rozdíly vlastností se sbalenými hodnotami; neporovnává viditelný text ani vykreslený vzhled. Hodnoty používají náhledy až o 2048 znacích, takže rozdíly za náhledem se nemusí zobrazit a částečná revize nemůže prokázat, že jsou dva soubory shodné. Příkaz CLI `prepare --strip-hidden-data` odstraňuje podporované vlastnosti DOCX a soukromá obálka revize může vybrat jednotlivé z nich. Selhání pojistky čištění soubor ponechá a ohlásí neúspěšnou operaci.
:::

## Každý síťový požadavek, který aplikace může vytvořit

Většina požadavků přináší na tvé zařízení nástroje, písma nebo modely. Akce odeslání přenášejí soubor, který jsi vybral, synchronizace přenáší zálohu do úložiště, které sis zvolil, a služby organizace přenášejí obsah nebo údaje potřebné pro sdílenou práci. Každá skupina níže uvádí, co zařízení opouští, kdy a co se stane, když provozovatel požadavek zablokuje. Nakonfigurovaní poskytovatelé identity a assetů provozovatele mohou do daného nasazení přidat další cíle. [Každý pevný hostitel v jedné tabulce](#every-fixed-host-in-one-table) uvádí hostitele, se kterými může webová aplikace komunikovat.

::: details Co se stahuje na tvé zařízení
- <!--i:download--> **Katalog nástrojů.** Nic osobního: požadavek na veřejný index nástrojů a assetů samotné Lolly, na vlastní adresu aplikace, při spuštění a poté uložený do offline cache. Pokud je zablokován, aplikace běží z nástrojů v cache a přestane objevovat nové.
- <!--i:sparkle--> **Sady emoji.** Sada, kterou zvolíš, se stáhne z vlastní adresy aplikace při prvním použití. Neodesílá se nic osobního. Animace Lottie se čtou na zařízení a nikoho nekontaktují.
- <!--i:document--> **Google Fonts.** Název zvolené rodiny a tvá IP adresa putují na písmové servery Googlu (`fonts.googleapis.com` pro stylopis, `fonts.gstatic.com` pro soubor písma). Stane se to jen tehdy, když přidáš Google Font v Design System Setup, a až poté, co v dialogu, který říká přesně toto, souhlasíš. Každá rodina se stáhne jednou, pak se uchová na zařízení a používá offline. Pokud je zablokováno, výběr selže bezpečně; nahraj místo toho soubor písma.
- <!--i:cpu--> **AI modely na zařízení.** Nic osobního: stažení souboru modelu, který se pak uchová na zařízení. Webové sestavení ve výchozím stavu používá vlastní adresu aplikace; sestavení může uvést jiného hostitele modelů, například hostitele vydání Lolly `lolli.li` pro balíčkové aplikace. Hostitel obdrží požadavek a tvou IP adresu, bez účtu a bez vstupů modelu. Stane se to jen tehdy, když použiješ funkci, která model potřebuje (hluboké skenování ve Verify, zvětšování obrázků, řeč a podobně), nebo si zvolíš stáhnout modely pro offline použití. Pokud je zablokováno, ta funkce počká a vše ostatní funguje.
- <!--i:sliders--> **Tiskové profily ICC.** Nic osobního: požadavek na standardní profil tiskových podmínek z veřejného registru ICC (`registry.color.org`, `www.color.org`), jen když klikneš na předvolbu ICC ve správci tiskových profilů, jednou na profil. Pokud je zablokováno, předvolby selžou; dodej vlastní profil `.icc`.
- <!--i:globe--> **Internetové rádio.** Nic osobního: požadavek na playlist a zvukový stream ze stanice (`api.somafm.com` a streamovací server, na který odkazuje, `*.somafm.com`), jen když v přehrávači zvuku přehráváš volitelné rádio. Pokud je zablokováno, rádio selže a všechny ostatní zvukové funkce fungují.
:::

::: details Nástroj, který potřebuje živá data
- <!--i:globe--> **Vyhledávání měst v Meeting Planneru.** Dnes je to jediný nástroj, který stahuje živá data. Žádá `geocoding-api.open-meteo.com`, aby každý název města (město hostitele i město každého člena týmu) převedl na souřadnice a časové pásmo, bez účtu, bez klíče a bez jiného identifikátoru než samotný požadavek. Vstup Host city to vysvětluje a každá odpověď se uloží na zařízení, takže se město vyhledá jen jednou. Běží, jen dokud je nástroj otevřený. Pokud je zablokováno, vyhledávání selže a nic dalšího to neovlivní.
:::

::: details Soubory, které odesíláš
Každá z těchto služeb odešle jen ten jediný soubor, který jsi vybral, když stiskneš její tlačítko Send, po přihlášení, které dokončíš v okně samotné služby. Heslo aplikace Bluesky, adresa webhooku Discordu, heslo aplikace Nextcloud a klíče S3 se ukládají jen na tomto zařízení, nikdy do zálohy, a **Disconnect** je vymaže.

- <!--i:upload--> **Google Drive.** Soubor v libovolném formátu putuje na rozhraní Drive API Googlu (`www.googleapis.com`). Přístup Lolly je omezen na soubory, které sama vytvořila (rozsah `drive.file`), takže nikdy nemůže číst zbytek tvého Drivu. Ve webové aplikaci se přihlašovací token drží v paměti po dobu relace a nikdy se neukládá; v ostatních aplikacích se obnovovací token ukládá jen na tomto zařízení, pokud zaškrtneš **Stay connected**. Tlačítko existuje jen v sestaveních, kde provozovatel nakonfiguroval ID klienta Google. Pokud je zablokováno, tlačítko se nikdy neobjeví; stáhni soubor a nahraj ho sám.
- <!--i:upload--> **Dropbox.** Soubor putuje na API Dropboxu (`api.dropboxapi.com` pro přihlášení a metadata, `content.dropboxapi.com` pro soubor). Přístup je jen do složky aplikace, takže Lolly tam vidí `Apps/` a svou vlastní složku a nic dalšího. Odkaz **Open**, který zobrazí, je krátkodobý soukromý odkaz a nevytváří se žádné veřejné sdílení. Obnovovací token se ukládá, jen pokud zaškrtneš **Stay connected**. Tlačítko existuje jen s ID klienta Dropboxu nakonfigurovaným provozovatelem.
- <!--i:upload--> **OneDrive.** Soubor putuje do služeb identity a Graph společnosti Microsoft (`login.microsoftonline.com` pro přihlášení, `graph.microsoft.com` pro nahrání); velký soubor se nahrává po částech na `api.onedrive.com` nebo do úložišť, která provozovatel nakonfiguroval. Přístup je omezen na vlastní složku Lolly pod `Apps/` plus tvé zobrazované jméno pro popisek účtu. Obnovovací token se ukládá, jen pokud zaškrtneš **Stay connected**. Tlačítko existuje jen s ID klienta Microsoftu nakonfigurovaným provozovatelem.
- <!--i:upload--> **LinkedIn**, **jen v desktopových aplikacích**. Soubor s názvem jako textem příspěvku putuje na LinkedIn (`www.linkedin.com` pro přihlášení ve tvém vlastním prohlížeči, `api.linkedin.com` pro nahrání a příspěvek) jako veřejný příspěvek na tvé vlastní zdi. Lolly může přispívat tvým jménem a číst tvé jméno pro popisek účtu, nic dalšího. Přihlášení se uchová, jen pokud zaškrtneš **Stay connected**, a tokeny LinkedInu platí 60 dní a nelze je obnovit potichu, takže vyprší samy. Tito hostitelé nejsou v politice připojení webové aplikace. Tlačítko existuje jen v sestaveních s nakonfigurovanou aplikací LinkedIn.
- <!--i:upload--> **Penpot.** Tvůj osobní přístupový token Penpotu, který vložíš do aplikace, a archiv `.penpot` návrhu putují na API Penpotu (`design.penpot.app`) přes malou průchozí vrstvu na vlastní adrese aplikace (`/api/penpot`), protože API Penpotu přímo prohlížeči neodpoví. Průchozí vrstva předá a zapomene; desktopové aplikace komunikují s Penpotem přímo. Stane se to jen tehdy, když v nástroji Design stiskneš **Send to Penpot** a potvrdíš projekt. Pokud je zablokováno, odeslání selže bezpečně; exportuj soubor `.penpot` a importuj ho sám.
- <!--i:upload--> **Bluesky.** Obrázek, jeho název jako text příspěvku a alt text a tvůj handle a heslo aplikace (vytvořené v Bluesky → Settings → App passwords, nikdy heslo k tvému účtu) putují na server Bluesky, který uvedeš, `bsky.social`, pokud nezvolíš jiný. Účet nejprve připojíš v **Settings → Connected services**.
- <!--i:upload--> **Discord.** Soubor putuje jako příloha na adresu webhooku kanálu, kterou jsi vložil, na discord.com. Kdokoli, kdo má adresu webhooku, může do toho kanálu přispívat, proto zůstává na zařízení.
- <!--i:upload--> **Mastodon.** Soubor s názvem jako textem příspěvku putuje na server Mastodon nebo kompatibilní, který uvedeš, po přihlášení v okně tohoto serveru. Připojení na tomto serveru zaregistruje malou aplikaci pro toto zařízení a přihlášení se uchová, jen pokud zaškrtneš **Stay connected**.
- <!--i:upload--> **Nextcloud nebo WebDAV.** Soubor putuje na tvůj vlastní server jedním ověřeným nahráním, se zadanou adresou serveru, uživatelským jménem a heslem aplikace (Nextcloud → Settings → Security → Devices & sessions; nikdy heslo k účtu).
- <!--i:upload--> **Úložiště kompatibilní s S3.** Soubor putuje do tvého vlastního bucketu (AWS S3, MinIO, R2, B2, Garage nebo jakýkoli endpoint SigV4), podepsaný na zařízení zadanou dvojicí klíčů.

**Hostitele, které zvolíš, musí schválit provozovatel.** Hostitelé Bluesky, Discord, Mastodon, Nextcloud a S3 nejsou v pevném seznamu Lolly, protože je volíš ty. Aplikace jim nic nepošle, dokud provozovatel neschválí přesně tohoto hostitele HTTPS: na webu v Content Security Policy nasazení, v desktopových aplikacích při sestavení aplikace. Totéž platí pro vlastní úložiště a hostitele nahrávání na SharePoint. Na webu musí server navíc povolit volání z prohlížeče z aplikace (CORS) a přesměrování selže bezpečně, proto použij adresu, která nepřesměrovává. Desktopové aplikace kontrolují každé přesměrování proti schválenému seznamu.

Tento seznam omezuje, na které hostitele se aplikace může dostat. Nerozlišuje účty ani tenanty u Googlu nebo Microsoftu a o tom, které účty a akce jsou povolené, rozhodují oprávnění samotného poskytovatele. Nevztahuje se ani na přihlašovací okna, jiné typy zdrojů nebo nativní funkce, které mají vlastní pravidla. Změna vyžaduje nové desktopové sestavení nebo nové hlavičky webové odpovědi; než aplikaci znovu otevřeš, ulož si práci. [Původy konektorů](/info/connector-origins.html) popisují konfiguraci.
:::

::: details Synchronizace mezi tvými zařízeními
- <!--i:folder--> **Co odchází.** Kopie toho, co jsi na tomto zařízení vytvořil (uložené relace a projekty, tvé designové systémy s jejich písmy a logy, nahrané obrázky, tvůj profil a předvolby) jako jeden soubor do jediného úložiště, které sis zvolil: složka aplikace Lolly v tvém Dropboxu (`api.dropboxapi.com`, `content.dropboxapi.com`), soubory, které Lolly vytvořila na tvém Google Drivu (`www.googleapis.com`), složka aplikace Lolly na tvém OneDrivu (`graph.microsoft.com`, větší soubory se nahrávají na `api.onedrive.com` nebo do úložišť, která provozovatel nakonfiguroval, a stahují se z přesných úložišť, která provozovatel nakonfiguroval), nebo tvůj vlastní Nextcloud, server WebDAV či bucket S3. Totéž úložiště uchovává až sedm denních kopií a jednu kopii z doby před posledním použitím.
- <!--i:shieldcheck--> **Nic nejde do Lolly.** V cestě není žádný server Lolly, relay ani server Lolly Work a aplikace k tomu nepotřebují žádný web Lolly, ani pro přihlášení. Kopie se na zařízení nejprve zašifruje, jen pokud nastavíš přístupovou frázi. Přihlášení, klíče, hesla aplikací, přístupová fráze a nastavení synchronizace zůstávají na zařízení a v kopii nikdy nejsou. Na webu si zapamatované připojení ke Google Drivu uchovává jen název tvého účtu (a tvé vlastní ID klienta, pokud jsi nějaké zadal) a přihlášení ke Googlu trvá jednu návštěvu. V aplikaci pro Android jde přihlášení ke Google Drivu přes Google Play services v telefonu, které provozuje Google.
- <!--i:sliders--> **Kdy.** Teprve po zapnutí **Sync across my devices** nebo stisknutí **Sync now**: nahrání krátce po každé změně a při opuštění aplikace a kontrola novější kopie při spuštění aplikace. Pokud je zablokováno, synchronizace selže a řekne proč a tvá práce zůstane na zařízení. Místo toho můžeš exportovat data do souboru a přenést je sám. Funkci popisuje [Synchronizace zařízení](/info/sync.html).
:::

::: details Webové stránky, snímky a obrázky z jiných webů
- <!--i:monitor--> **URL, kterou nástroji zadáš k zachycení.** Nástroj URL screenshot požaduje přesnou adresu, kterou napíšeš, jen když zahájíš zachycení. Protože adresu volíš v tu chvíli, není v politice připojení a provozovatel ji nemůže povolit ani zablokovat podle hostitele; chceš-li ji odstranit, odstraň nástroj.
- <!--i:globe--> **Webová stránka v poli Design.** Stránka se vyžádá s tvou IP adresou z webu, odkud pochází, spolu se vším, co si žádá sama stránka. Kde to prohlížeč podporuje, rámec nedostane žádné cookies ani adresu kromě původu samotné aplikace, takže tvůj dokument a jeho odkaz s požadavkem nikdy necestují. Ve webové aplikaci lze zarámovat jen tyto přehrávače: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (mapy) a `www.figma.com`, plus referenční stránky na `wikipedia.org` a `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` a `www.openstreetmap.org`. **Allow pages from any site** v **Settings → Trusted sites** znovu načte Lolly na tvém zařízení s politikou, která může zarámovat jakoukoli stránku `https:`, a stále platí stejná pravidla o důvěře a ptaní. Stránka se načte jen pro web v tvých Trusted sites, včetně odstranitelných výchozích referenčních, nebo poté, co to pole schválíš v jeho inspektoru; balíček, který ti někdo poslal, do té doby ukazuje obrázek každé stránky. Před prezentací seznam nabízí u každého webu **Just this time** a **Always trust** a během prezentace se neptá na nic. Pokud je zablokováno, pole ukáže svůj obrázek s odkazem pro otevření stránky na nové kartě. Nástroje Lolly a ukázky Sandbox v poli běží na vlastní adrese aplikace a nikoho nekontaktují.
- <!--i:sliders--> **Úprava zobrazené stránky.** Akce **Use page** pole webové stránky ti umožní odmítnout cookies nebo zavřít banner uvnitř stránky. U přístupných stránek Lolly **Hide cookie banners** skryje známé překryvy, včetně OneTrust, aniž by přijal cookies nebo změnil souhlas webu. **Page CSS** mění živou stránku a prezentaci toho pole; exporty nadále používají zvolený plakát. Pravidla nemohou importovat zdroje ani písma a prohlížeče Lolly brání měnit CSS jiného webu. Náhledy Sandbox mají vlastní editor CSS pod **Edit in Sandbox**.
- <!--i:code--> **Webové zdroje ukázky Sandbox.** Každý stylopis, skript, písmo nebo obrázek, na které kód ukázky odkazuje, se vyžádá s tvou IP adresou a bez cookies z webu, který je hostuje; soubory, které pojmenuje stažený stylopis, například soubory písem Google Fonts, se počítají jako samostatné weby. Stane se to jen po kliknutí na **Fetch & inline** nebo u webu v tvých Trusted sites; **Always trust** vedle souboru přidá jeho web do toho seznamu. Pokud je zablokováno, ukázka běží bez těchto souborů a Sandbox vypíše každý soubor, který nešlo stáhnout, a proč.
- <!--i:download--> **Přidání obrázku z URL.** **Add from URL** ve výběru assetů nebo v Assets požaduje přesnou adresu obrázku, kterou vložíš. Vlastní politika webové aplikace brání prohlížeči stáhnout jiný web přímo, takže obrázek stáhne malá průchozí vrstva na vlastní adrese aplikace (`/api/fetch-image`) a vrátí jen bajty; nic neukládá, adresu zapomene a odmítne cokoli, co není veřejnou adresou obrázku. Desktopové aplikace stahují adresu přímo. Vložený odkaz Lolly se nestahuje vůbec: vykreslí se na zařízení. Pokud provozovatel průchozí vrstvu vypne (`LOLLY_DISABLE_IMAGE_PROXY=1`), lze ve webové aplikaci přidat jen odkazy Lolly, obrázky `data:` a obrázky ze stejného původu a desktopových aplikací se to netýká.
- <!--i:palette--> **Designový systém z webu.** Design System Setup může přečíst jednu stránku webu, který uvedeš, přes [rozšíření prohlížeče](#the-browser-extension) nebo vlastní stahování desktopové aplikace, nikdy přes server Lolly. Před stisknutím se nic nestahuje a odkazy na stránce se nenásledují.
:::

::: details Práce s dalšími lidmi a agenty
- <!--i:link--> **Soukromá spolupráce.** Dvě zařízení se spojí přímo, bez serveru uprostřed. Pozvánka a odpověď nesou adresy, které každé zařízení vidí na své vlastní síti, a toto sestavení nekonfiguruje žádný vnější server pro zjišťování adres, proto je dej jen osobě, s níž pracuješ. Viz [Spolupráce](/info/collaborate.html).
- <!--i:monitor--> **Nearby** v desktopové aplikaci. Dokud jsi viditelný, což je deset minut po zahájení pozvánky ke spolupráci nebo, pokud to zapneš, kdykoli aplikace běží, aplikace v místní síti oznamuje náhodný název, zobrazované jméno, které sis zvolil, a druh zařízení. Neoznamuje žádnou e-mailovou adresu, účet ani trvalý identifikátor.
- <!--i:link--> **Pozvání agenta.** Stav pozvaného dokumentu, náhledy, které agent požaduje, identita agenta a jeho úpravy procházejí nakonfigurovaným živým relay (`lolly.ing` na lolly.tools) k agentovi, kterého zveš. Nainstalovaný hostovaný plugin také předává volání přes konektor lolly.tools k relay, který pozvánka vybere; konektor mezi voláními nedrží žádnou pozvánku ani dokument. Relay drží pozvánky a čekající požadavky v paměti, dokud se neodpojíš nebo nevyprší jejich platnost: deset minut u nepoužité pozvánky a třicet minut bez aktivity u připojené. Poskytovatel tvého agenta zpracovává data, která obdrží, podle vlastních zásad. Stane se to jen poté, co v Share vytvoříš pozvánku a předáš její pokyny agentovi; přístup ke čtení umožňuje prohlížení a přístup k úpravám i změny. Pause zastaví změny a Disconnect nebo odvolání pozvánky ukončí přístup. Pokud je zablokováno, agent se nemůže připojit ani pokračovat a ty dál upravuješ.
- <!--i:cpu--> **Allow AI control** v desktopové aplikaci. Agent běžící na tomto počítači může číst a upravovat otevřený dokument Design přes spojení, které zůstává na počítači. Je vypnuto, dokud ho nezapneš. Lolly pro to nic neposílá na server; poskytovatel agenta zpracovává to, co agent čte, podle vlastních zásad. [Threat Model & Trust Boundaries](/info/threat-model.html) uvádí, co takový agent může a nemůže dělat.
- <!--i:server--> **Vzdálená instance.** Když aplikaci nasměruješ na jiné nasazení Lolly, dostane vše, co ta instance vrátí, přes stejnou synchronizaci katalogu, plus značku verze u požadavků na ni (druh aplikace a verze enginu, stejná informace, jakou nese user agent), aby její provozovatel viděl, které verze Lolly se používají. Ve spravované instanci nese značka po dobu přihlášení také ID instalace pro toto zařízení, aby seznam zařízení provozovatele rozlišil instalace; odchod ID smaže a zařízení, které se později znovu připojí, předloží nové. Hostitele volíš ty, proto není v politice připojení. Pokud je zablokováno, přepnutí selže a tvá místní instance zůstane nedotčena.
- <!--i:people--> **Instance Lolly Work tvé organizace.** Identita přihlášení a informace o zařízení, požadavky na zásady, sdílené relace, úpravy při spolupráci, nahrávání, odeslání ke schválení a soubory k doručení, které používáš, a povolené štítky událostí používání tam, kde jsou nakonfigurovány, jdou do instance tvé organizace, přičemž přihlášení probíhá přes její poskytovatele identity. Obnovování zásad a zapnutá telemetrie mohou běžet během používání; sdílená práce, spolupráce, revize a doručení v rámci těchto procesů odesílají obsah. Pokud je zablokováno, tyto funkce organizace se nedokončí a tvá osobní práce zůstane oddělená. Viz [Služby organizace s Lolly Work](#organisation-services-with-lolly-work).
:::

### Každý pevný hostitel v jedné tabulce

Content Security Policy webové aplikace brání skriptu dostat se k jakémukoli hostiteli, který neuvádí. Kromě vlastní adresy aplikace tabulka uvádí každého hostitele, kterého tato politika vypisuje, plus dva hostitele LinkedInu, které přidávají desktopové aplikace, označené jako jen desktopoví. Test v CI porovnává tuto tabulku s nasazenou politikou, takže hostitele nelze přidat do jednoho bez druhého.

| Co | Co skutečně opouští tvé zařízení | Hostitelé |
|---|---|---|
| Modely na zařízení v balíčkových aplikacích a soubory vydání | Požadavek na veřejný soubor s tvou IP adresou | `lolli.li` |
| Google Fonts | Název rodiny písma a tvá IP adresa | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Odeslání na Google Drive a synchronizace s ním | Soubor nebo záloha, které jsi vybral | `www.googleapis.com` |
| Odeslání na Dropbox a synchronizace s ním | Soubor nebo záloha, které jsi vybral | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Odeslání na OneDrive a synchronizace s ním | Soubor nebo záloha, které jsi vybral, a tvé zobrazované jméno pro popisek účtu | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Vyhledávání měst v Meeting Planneru | Každý název města | `geocoding-api.open-meteo.com` |
| Tiskové profily ICC | Požadavek na veřejný profil | `registry.color.org`, `www.color.org` |
| Internetové rádio | Požadavek na playlist a zvukový stream | `api.somafm.com`, `*.somafm.com` |
| Pozvání agenta a pracovní prostor lolly.ing | Stav pozvaného dokumentu, náhledy a úpravy a požadavky pracovního prostoru, které odešleš | `lolly.ing` |
| Přehrávače ve webovém poli Design | Požadavek na stránku s tvou IP adresou | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Referenční stránky ve webovém poli Design | Požadavek na stránku s tvou IP adresou | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Odeslání na LinkedIn, jen v desktopových aplikacích | Soubor s názvem jako veřejný příspěvek | `www.linkedin.com`, `api.linkedin.com` |

Vlastní seznam desktopových aplikací obsahuje také token endpoint Googlu pro přihlášení k Drivu. Jakýkoli jiný hostitel, například server Mastodon nebo Nextcloud, který uvedeš, potřebuje schválení provozovatele, jak je popsáno v části Soubory, které odesíláš. Hostitelé, které volíš v okamžiku použití, například URL, kterou zachytíš, nebo vzdálená instance, kterou uvedeš, nejsou v žádném seznamu.


**Podpisy SEAL nevytvářejí žádný požadavek.** Verify umí kontrolovat podpisy SEAL, schéma, jehož podpisový klíč lze zveřejnit v DNS. Prohlížeče nemohou posílat dotazy DNS, takže by webové vyhledání muselo jít přes překladač DNS-over-HTTPS třetí strany, který by viděl kontrolovanou doménu a tvou IP adresu. Lolly dříve používala překladač Cloudflare; už ho nepoužívá a Cloudflare nic nenahradilo. Dnes žádná aplikace Lolly klíče SEAL nevyhledává: desktopové a mobilní aplikace spouštějí stejné zobrazení Verify a příkazový řádek `lolly validate` SEAL nekontroluje. Soubor, jehož záznam SEAL nese klíč přímo v sobě, se kontroluje offline a Verify označí podpis za vnitřně konzistentní, aniž by potvrdil doménu. Soubor, jehož klíč je jen v DNS, zobrazí **SEAL signature did not verify** s důvodem "no key resolver and no inline key".

![Obrazovka Verify: cíl pro přetažení a nic dalšího - soubor se kontroluje tam, kde už je, bez nahrávání a bez účtu](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Toto i každé další tvrzení na této stránce si můžeš ověřit sám: [Ověř si to sám](/info/verify-yourself.html) uvádí příkazy a očekávaný výstup.

## Služby, které lolly.tools provozuje

Tyto služby běží na lolly.tools pro všechny. Každá dostane jen to, co jí pošleš. [Serverový povrch](/info/server-surface.html) popisuje tytéž součásti tak, jak fungují v libovolném nasazení.

### Odkazy pro vykreslení

Každá adresa URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` se skutečně vykreslí a její vstupy putují v URL, takže sdílený odkaz Lolly se může zobrazit jako živý obrázek v README, wiki nebo na dashboardu. Jeho načtení žádá server, aby vykreslil **veřejná data nástrojů a katalogu** se vstupy zapsanými v adrese.

- <!--i:usercheck--> **Žádné účty, žádné cookies, žádný stav.** Cesta nevyžaduje přihlášení a nic na tvém zařízení se nečte. Tvé dokumenty, relace a nahrané soubory nikdy neopustí tvůj prohlížeč a v těchto odkazech se objevit nemohou.
- <!--i:document--> **Zaznamenává se samotná URL.** Řetězec dotazu URL je součástí požadavku, takže se objeví v běžných přístupových logech hostingové platformy jako každá požadovaná cesta. Pokud vstupy odkazu obsahují něčí jméno nebo e-mailovou adresu, třeba jmenovka nebo e-mailový podpis, **ten text leží v těchto logech**. Do odkazu pro vykreslení dávej jen to, co bys dal na veřejnou stránku.
- <!--i:globe--> **Vstupy jsou stejně veřejné.** Jsou to, co autor odkazu napsal do URL, a přečte je každý, ke komu se odkaz dostane. Nevkládej do sdíleného odkazu tajemství; Lolly nabízí pro citlivý obsah šifrování odkazů.
- <!--i:eyeoff--> **Cache, limity a bez indexace.** Odpovědi se ukládají do cache a mají omezenou frekvenci jako každý veřejný obrázek a jsou označeny `noindex`, aby tvá vykreslení vyhledávače vynechaly.

Samostatně provozované nasazení, které veřejnou cestu pro vykreslení nechce, nastaví `LOLLY_DISABLE_RENDER_GET=1` a každá z těchto URL vrátí 404.

### Stahovač obrázků a průchozí vrstva Penpotu

**Add from URL** ve webové aplikaci a **Send to Penpot** používají dvě malé průchozí vrstvy na lolly.tools, popsané v části [Každý síťový požadavek, který aplikace může odeslat](#every-network-request-the-app-can-make). Stahovač obrázků nic neuchovává a adresu zapomene. Průchozí vrstva Penpotu předá tvůj token a archiv Penpotu a neuchovává ani jedno; zaznamenává název příkazu a stavový kód odpovědi Penpotu.

### Server MCP pro AI agenty

AI agent se může k Lolly dostat přes Model Context Protocol, přes endpoint, který provozuje provozovatel. lolly.tools jeden provozuje a kdokoli může provozovat vlastní, včetně úplně offline.

- <!--i:cpu--> **Soubory, které agent posílá.** Nástroje, které berou soubor (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` a obrazové nástroje `lolly_look`, `lolly_sample_color` a `lolly_trace_edges`), ho zpracují v paměti a vrátí výsledek ve stejném volání. Soubor se nikdy nezapisuje na disk a po dokončení požadavku se neuchovává. `lolly_inspect` také bere soubor a jeho kontroly videa a tiskové přípravy zapisují dočasnou pracovní kopii, která se po návratu volání smaže. Každý další nástroj pracuje s parametry volání: text, čísla, barvy, URL, ID assetů katalogu nebo dokument, který dodá volající.
- <!--i:cpu--> **Rebrand uvádí, kam balíček míří.** První fáze `lolly_rebrand`, `capabilities`, slovy říká, kam by tvé bajty šly, dřív než cokoli pošleš: na samostatně provozovaném místním serveru balíček ten počítač nikdy neopustí a na hostovaném serveru volání `lolly_rebrand` balíček tam odešle, až do limitů velikosti a počtu snímků, které ta fáze uvádí.
- <!--i:lock--> **Otevřený endpoint.** Na lolly.tools je `lolly.tools/api/mcp` otevřený každému bez tokenu. Volání jsou omezena podle adresy a denním rozpočtem. Adresa se v úložišti pro kontrolu zneužití stává pseudonymním digestem, stejně jako u přihlašovacích endpointů níže, a rozpočet počítá jen čas CPU a odeslané bajty, bez adresy. Bearer token omezeného endpointu se nikdy nezapíše do logu ani do URL vykreslení.
- <!--i:link--> **Odkazy ke stažení velkých výsledků.** lolly.tools vrací výsledky přímo a tyto odkazy nikdy nevydává. Provozovatel je může zapnout pro svou vlastní ověřenou bránu, kde se výsledek drží nejvýše pět minut a stáhnout ho může jen vlastní bearer token volajícího; viz [Server MCP](/info/mcp.html#private-download-links-for-large-results). Plánovaný omezený endpoint na `mcp.lolly.tools` by bral bearer token, který provozovatel vydá důvěryhodným klientům, nebo OAuth 2.1 s krátkodobými podepsanými tokeny ověřovanými proti sdílenému tajemství; jeho aktivace čeká a je uveden v části [Hostitelé doručování a zpracovatelé](#delivery-hosts-and-processors).

### Ověřená identita: přihlášení, které zahájíš sám

Lolly může do tvých exportů zapečetit **Content Credential**, aby kdokoli mohl offline ověřit, že se soubor od opuštění Lolly nezměnil. To je **ve výchozím stavu zapnuto a zcela lokální**: podpisový klíč se vytváří na tvém zařízení a podepisování probíhá offline. Bez zápisu je ten klíč jednorázový, nový pár klíčů vytvořený pro každý export a poté zahozený. Po zápisu klíč přetrvává a vytváří se jako **neexportovatelný**, takže ho nemůže přečíst ani vlastní kód Lolly, jen požádat o podpis. V obou případech nikdy neopustí tvé zařízení.

[Exportování](/info/exporting.html#content-credentials-c2pa) uvádí, co credential zaznamenává: nástroj, čas, hrubý exportní povrch, tvé jméno jen pokud jsi zapnul *Use my details*, připsaná díla, která export obsahuje, a každou píseň Rondocode, kterou video nebo audio export přehrává (její název, hash zdroje a jak ji sandbox Lolly vykreslil). Panel exportu tyto písně vypíše před exportem.

Credential a metadata souboru také zaznamenávají [designový systém a colourway](/info/exporting.html#the-design-system-record), které export vykreslily: ID a název designového systému, jeho zveřejněnou verzi a colourway. Název designového systému je text, který napsali jeho vlastníci, a může to být jméno klienta, proto karta **Design system** v panelu exportu ukáže přesná slova před exportem. Zrušením zaškrtnutí karty nebo předáním `_madewith=0` či `--no-madewith` je vynecháš.

Jediný *volitelný* krok navíc je zápis ověřené identity, aby tvé exporty hlásily "Verified - signed by \<your email\>" místo pojmenování anonymního klíče. **Pokud zápis přeskočíš, certifikační služba od tebe neobdrží žádná data o zápisu.**

![Karta Verified identity v Settings na šířku telefonu: volič platnosti certifikátu a krok zápisu pod ním, nečinné, dokud ho sám nespustíš](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Pokud se zapíšeš, stane se přesně toto:

::: timeline
- <!--i:usercheck--> **Zvolíš způsob přihlášení**: GitHub, Google, SUSE (id.suse.com) nebo odkaz zaslaný e-mailem. U tří poskytovatelů OIDC přejdeš na přihlašovací stránku samotného poskytovatele, podle jeho zásad ochrany soukromí, ne našich, a certifikační služba dostane zpět jen ověřenou e-mailovou adresu a název poskytovatele. U e-mailového odkazu jde adresa, kterou napíšeš, službě **Resend**, transakční e-mailové službě, jen kvůli doručení toho jednoho odkazu.
- <!--i:lock--> **Krátkodobé cookie chrání přesměrování.** Certifikační služba nastaví `lolly_ca_state`, `HttpOnly`, s rozsahem `/api/ca` a platností do deseti minut. Nese náhodnou hodnotu, ne sledovací identifikátor, existuje jen proto, aby přesměrování po přihlášení nešlo padělat, a po dokončení přihlášení se smaže.
- <!--i:eyeoff--> **Tvá IP adresa se krátce používá k předcházení zneužití** přihlašovacích endpointů, aby jeden skript nemohl zaplavit schránku ani vyčerpat kvótu e-mailů. Lolly ji převede na digest SHA-256, než se dostane do krátkodobého úložiště pro kontrolu zneužití, takže se tam nepošle surová adresa. Digest je pseudonymní, ne anonymní: kdo by úložiště držel, mohl by adresu IPv4 získat zkoušením všech možných. Kbelík vyprší asi za minutu a nepoužívá se k ničemu jinému. Běžné přístupové logy hostingu jsou oddělené a popsané níže.
- <!--i:seal--> **Služba vydá certifikát** vázající tvou ověřenou e-mailovou adresu na veřejný klíč tvého zařízení. Soukromý klíč zůstává na zařízení: klient pošle žádost o certifikát s vázaným důkazem držení a žádný soukromý klíč zařízení nejde ani do jednoho režimu vydavatele.
- <!--i:check--> **Podepisování zůstává lokální.** U staršího vydavatele export nepotřebuje žádný požadavek na certifikační službu. Spravovaná identita také potřebuje čerstvý podepsaný seznam odvolání od svého vydavatele; klient může použít seznam z cache v rámci nakonfigurovaného okna čerstvosti a jeho obnovení může během exportu kontaktovat certifikační službu. Chybějící, prošlý nebo neplatný stav brání použití spravované identity.
:::

::: details Uchovávání a odvolání v každém režimu vydavatele
**Starší hostované vydávání** nabízí 7, 30, 90 nebo 365 dní, omezeno provozovatelem. Nevede žádný inventář identit ani log vydávání, takže nemůže vyhledat, kdo certifikát získal, ani odvolat certifikáty té osoby; odvoláním je platnost.

**Spravované vydávání pro organizaci** používá výchozí platnost nejvýše 24 hodin a maximum sedm dní, s vlastním kořenem a politikou důvěry vydavatele, a podepisování jde na vydavatele Vault, kterého provozovatel nakonfiguroval. Jeho aplikace pro zápis používá sdílené úložiště přijetí na jedno použití, které drží jen klíčovaný ověřovací identifikátor a digest požadavku, nejvýše deset minut, a neukládá žádný inventář identit ani cache odpovědí s certifikáty. Poskytovatel PKI, jeho auditní zařízení, brány a zálohy mají vlastní toky dat. I při vypnutém běžném úložišti vydávání může odvolání založené na certifikátech uchovat certifikát včetně jeho e-mailové identity a sériová čísla odvolání a auditní identifikátory mohou zůstat propojitelné; o tomto inventáři, o tom, kdo k němu má přístup a jak dlouho se uchovává, rozhoduje politika tvého provozovatele.

Spravované zařízení může požádat o odvolání vlastního certifikátu s ověřeným důkazem zařízení a žádné API nežádá o soukromý klíč zařízení. Provozovatel může vydavatele stáhnout prostřednictvím své politiky důvěry. Lolly nevede žádné mapování lidí na certifikáty, takže odvolání certifikátů osoby po jejím odchodu závisí na záznamech, které vede provozovatel, a záznamy PKI, auditní záznamy, příjemci a zálohy se řídí politikou provozovatele. [Návrh certifikační služby](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) popisuje úschovu vydavatele, uchovávání u poskytovatele a kvalifikaci.
:::

## Služby organizace s Lolly Work

**Lolly Work** je volitelná služba projektu Lolly pro organizace, kterou nasazuje samostatně každá organizace provozující instanci. Připojení k instanci přidává data držená na tom serveru vedle tvých místních úprav. Její provozovatel odpovídá za zásady ochrany soukromí, řízení přístupu, příjemce, uchovávání a zálohy toho nasazení.

| Pracovní postup | Data zpracovávaná službou organizace |
|---|---|
| Přihlášení a zřizování | Tvrzení poskytovatele identity, členství v účtech a skupinách, přihlašovací relace a informace o zařízení. Přihlášení obsluhuje OIDC; správci mohou účty zřizovat a deaktivovat přes SCIM |
| Sdílený katalog a projekty | Nahrané assety, metadata a verze; sdílené projekty a relace; obsah získaný z nakonfigurovaných poskytovatelů knihoven |
| Pracovní kolaborace | Stav sdílené relace, živé úpravy a přítomnost účastníků posílané přes instanci; uložený stav přetrvává podle její politiky úložiště |
| Spravované sdílené odkazy | Cíl odkazu a nastavení přístupu, například platnost a volitelná ochrana heslem; požadavky se řeší přes instanci a lze je odvolat |
| Revize a doručení | Odeslaný obsah, rozhodnutí o schválení, vybraný cíl, připravené soubory a potvrzení o doručení |
| Serverová vykreslení a dávky | Odeslané vstupy nástrojů, požadavky na vykreslení, stav a uchované výstupní soubory. Tyto úlohy běží na serveru, ne na tvém zařízení |
| Hlášení používání | Povolené štítky událostí, například ID nástroje, formát a ID assetu, podle politiky telemetrie níže |
| Audit | Záznamy o aktérech a akcích u řízených operací, vedené odděleně od telemetrie používání |

Služba používá ověřovací cookies, včetně `lw_session` pro přihlášené členy a `lw_guest` pro přístup hostů tam, kde je zapnut, oddělené od cookie certifikační služby. Obnovování zásad a zapnuté hlášení používání mohou posílat požadavky během používání aplikace, bez zvláštního kliknutí pro každý. Jde o provoz k nakonfigurované instanci, ne o hlášení projektu Lolly o nasazeních, která neprovozuje.

**Telemetrie používání má tři úrovně.** `off` neukládá žádné události používání, `aggregate` odstraňuje ID uživatelů a `standard` může události přiřazovat. Výchozí úroveň je `standard`, takže instance ukládá události používání, které obdrží, pokud její provozovatel nezvolí `off`. Výchozí politika přiřazení je `opt-in`, která před uložením ID uživatele vyžaduje tvůj souhlas; provozovatel může místo toho nakonfigurovat přiřazené hlášení pomocí `telemetryAttribution: default`. Povolené atributy jsou štítky, nikdy hodnoty vstupů nástrojů. Viz [Telemetrie Work](/info/work-telemetry.html).

**Audit je oddělený.** Řízené akce mohou uchovávat identifikovaný auditní záznam bez ohledu na tvůj souhlas s telemetrií. Vypnutí telemetrie nevypíná ukládání sdílených relací, záznamy o schválení, ukládání úloh vykreslení ani audit. Uchovávání a vymazání, včetně případné pseudonymizace auditního logu, řídí provozovatel; viz [Úložiště Work a životní cyklus dat](/info/work-data-lifecycle.html).

| | Tvé zařízení | Instance tvé organizace |
|---|---|---|
| Co drží | Tvá osobní práce, předvolby a cache | Sdílená práce, účty, nahrané soubory, schválení, vykreslení, audit a nakonfigurovaná telemetrie |
| Kdo to maže | Ty, pomocí **Clear all my data** nebo dat webu v prohlížeči | Provozovatel, vlastními ovládacími prvky instance |
| Koho se ptát | Nikoho: záznamy jsou na tvém zařízení | Provozovatele instance, kvůli přístupu, exportu nebo vymazání |

**Místní smazání není smazání na serveru.** Opuštění instance nebo vymazání prohlížeče odstraní místní stav, ne uložené záznamy ani zálohy organizace. Osobní [Synchronizace](/info/sync.html) a **Export my data** zálohují tvé zařízení, ne službu organizace. Veřejné demo [lolly.work](https://lolly.work) drží svůj stav jen v paměti a není trvalým úložištěm tvé práce.

## Rozšíření prohlížeče

Rozšíření prohlížeče **Lolly URL Screenshot** pro nás neshromažďuje žádné osobní údaje. Nemá analytiku, sledování ani vlastní server. Stránka [Rozšíření prohlížeče](/info/extension.html) popisuje, jak funguje.

**Co dělá.** Webová aplikace Lolly se ho může zeptat na snímek webové stránky nebo na obsah stránky pro založení designového systému z webu. Každý požadavek otevře v rozšíření okno schválení, které ukáže žádající web, zda chce snímek, nebo obsah stránky, a adresu stránky. Teprve po stisknutí **Approve once** rozšíření otevře tu stránku v dočasné záložce na pozadí, pořídí snímek nebo stránku přečte, předá výsledek kartě Lolly, která se ptala, a záložku zavře. Každý požadavek potřebuje vlastní schválení.

**Data.**

- <!--i:shieldcheck--> **Nic neshromažďujeme.** Výsledek jde jen na stránku Lolly, která se ptala, ve stejném prohlížeči. Rozšíření neukládá obsah stránek a nepřidává žádného dalšího příjemce.
- <!--i:globe--> **Síťové požadavky.** Stránka, kterou schválíš, se načte jako v jakékoli záložce, spolu se vším, co si žádá sama. Čtení obsahu stránky také stahuje stylopisy té stránky a několik jejích ikon a log, zevnitř stránky, a tato stažení neposílají cookies jiným webům. Rozšíření neprovádí žádné jiné požadavky a žádný nejde na server Lolly.
- <!--i:lock--> **Relace tvého prohlížeče.** Stránka se načte s relací tvého prohlížeče, jako kdybys ji otevřel sám, takže stránka, k níž jsi přihlášen, může do výsledku vložit soukromé informace.
- <!--i:link--> **Adresy, které schválíš,** se používají jen k načtení té jedné stránky pro ten jeden požadavek. Nezaznamenávají se ani nesdílejí.

**Oprávnění.**

- <!--i:wrench--> **`debugger`**: pořídit snímek přes protokol DevTools, stejným mechanismem, který používá desktopová aplikace Lolly.
- <!--i:monitor--> **`tabs`**: otevřít a zavřít dočasnou záložku a ověřit, že se od schválení nepřesunula ani stránka Lolly, ani cílová stránka.
- <!--i:code--> **`scripting`**: přečíst obsah stránky v dočasné záložce po schválení toho požadavku.
- <!--i:database--> **`storage`**: poznamenat si ID svých dočasných záložek v úložišti relace, aby se stále zavřely, i když prohlížeč rozšíření během požadavku zastaví. Neukládá se žádný obsah stránek.
- <!--i:check--> **Volitelný přístup k webům (`http://*/*`, `https://*/*`)**: při instalaci se neuděluje. Po stisknutí **Approve once** rozšíření požádá Chrome o přístup k jedinému webu v tom požadavku a Chrome se tě při prvním přístupu zeptá na každý web. Web, který jsi dříve povolil, stále potřebuje nové schválení pro každý požadavek.

Žádné z těchto oprávnění se nepoužívá ke čtení, sledování ani přenosu tvého prohlížení nad rámec jednoho požadavku, který jsi schválil.

## Hostitelé doručování a zpracovatelé

Veřejné soubory katalogu, nástroje a zobrazovací verze pocházejí ve výchozím stavu z vlastní adresy aplikace. Názvy odvozené od obsahu mění, odkud se soubor stahuje, ne kdo požadavek přijímá. Tato funkce doručování neaktivuje žádné CDN třetí strany. CDN, které ukončuje TLS, by dostalo podrobnosti požadavků, včetně IP adres a všech cookies či bearer přihlašovacích údajů, které se mu předají, i pod stejným názvem hostitele v prohlížeči, takže provozovatel, který nějaké přidá, přebírá nového zpracovatele.

**Před přidáním jakéhokoli CDN nebo externího hostitele modelů** musí správce zveřejnit název zpracovatele, název hostitele, jurisdikce, přijímaná metadata, uchovávání a ujednání o předávání. [Nasazení doručování](/info/deploy-delivery.html) uvádí, co zveřejnit. Odpovědi soukromého pracovního prostoru obcházejí sdílené cache: osobní výsledky, odmítnutí přístupu a chyby používají `private, no-store` a povolená soukromá odpověď se může v tvém prohlížeči znovu ověřit, aniž by se stala veřejnou.

Referenční služby používají níže uvedený hosting. Je to seznam názvů hostitelů, ne tvrzení, že instance jiné organizace používá stejný region.

| Název hostitele nebo služba | Funkce a příjemce | Region a nakládání s daty |
|---|---|---|
| lolly.tools | Veřejná aplikace, katalog, vykreslování a certifikační služby; hosting UpCloud | Frankfurt, Německo. Podrobnosti požadavků se mohou objevit v infrastrukturních logech; běžné místní úpravy zůstávají na zařízení |
| lolly.ing | Spravovaný pracovní prostor a služby dokumentového agenta; hosting UpCloud | Frankfurt, Německo. Soukromá databáze a úložiště souborů jsou na stejném hostiteli. Účty, sdílený obsah a záznamy služby se řídí politikou správce instance |
| mcp.lolly.tools | Plánovaná volitelná ověřená brána MCP a soukromá stahování výsledků; hosting UpCloud | Frankfurt, Německo, se stejným zpracovatelem hostingu. Aktivace čeká. Brána by přijímala podrobnosti požadavků a parametry nebo soubory, které její volající pošle |
| lolli.li | Veřejné soubory vydání a modelů; UpCloud Managed Object Storage, oddělené od aplikačního clusteru | Frankfurt, Německo, v regionu objektového úložiště UpCloud europe-2. Stažení odešle podrobnosti požadavku, ne vstupy, které model později zpracuje |
| Nakonfigurovaný poskytovatel identity | Google, GitHub nebo OIDC poskytovatel provozovatele | Přihlášení se řídí zásadami toho poskytovatele. Zeptej se provozovatele instance na název hostitele, region a ujednání o předávání |
| Nakonfigurovaný poskytovatel assetů | Brandfolder nebo jiná knihovna, kterou provozovatel vybere | Poskytovatel přijímá povolené požadavky knihovny. Přístup řídí oprávnění jeho zdroje a politika instance; zeptej se provozovatele na jeho názvy hostitelů a regiony |
| Zápis e-mailem, je-li nakonfigurován | Resend doručí požadovaný přihlašovací odkaz | Přijímá cílovou e-mailovou adresu pro tu zprávu; platí jeho vlastní podmínky zpracování |

Referenční aplikace nepoužívá žádný jiný hosting, databázi ani poskytovatele kontroly zneužití. Provozovatel může u jiné instance zvolit jiné poskytovatele a hosting, identita, assety i e-mail vyžadují každý své zveřejnění. [Region objektového úložiště](https://upcloud.com/docs/products/managed-object-storage/availability/) hostitele modelů se ověřuje odděleně od regionu aplikace.

**Volitelné odkazy ke stažení vázané na principála v MCP.** Provozovatel může zapnout odkazy ke stažení velkých výsledků na ověřené bráně s jednou replikou. Ve výchozím stavu jsou vypnuté. Anonymní brána na `lolly.tools/api/mcp` vrací výsledky přímo a tyto odkazy nikdy nevydává. Plánovaný omezený název hostitele je `mcp.lolly.tools`, u stejného zpracovatele UpCloud ve Frankfurtu; aktivace čeká a tato stránka netvrdí, že živá služba odkazů ke stažení existuje. Odkazy nepřidávají žádné CDN třetí strany.

Odkaz může obdržet jen ověřený volající s rozsahem pro soubory a k jeho stažení je vyžadován bearer téhož volajícího: použij ověřený bearer z volání vykreslení, ne jiný token téhož účtu. Oprávnění vyprší do 300 sekund. Vlastnictví a vyhledání výsledku zůstávají v paměti brány a výstupní bajty jdou do soukromých dočasných souborů, které se po vypršení promazávají nebo při řádném vypnutí odstraní. Restart brány zneplatní existující odkazy. Držené výsledky jsou omezeny na 64 MiB na bearer, 256 MiB v celé bráně a 200 čekajících nebo držených souborů. Denní rozpočty CPU a dekódovaných bajtů počítají výsledky při držení i při stažení. Odpovědi používají `private, no-store` a `Referrer-Policy: no-referrer`. Samotný token odkazu nedovolí jiné osobě ani agentovi výsledek přečíst.

## Infrastrukturní logy

Tato část popisuje veřejné nasazení lolly.tools. Jeho hostingová platforma zaznamenává běžné podrobnosti požadavků: IP adresu, požadovanou cestu, časové razítko a user agent. Místní úpravy tohoto hostitele nedosáhnou. Řetězec dotazu odkazu pro vykreslení může obsahovat text, který dodal jeho volající, jak je vysvětleno výše. Nástroje MCP pro soubory zpracovávají bajty, které dostanou, v paměti. Instance Lolly Work také drží záznamy popsané výše, podle logovací politiky svého provozovatele.

**Veřejné služby drží aplikační logování na minimu.** Server MCP loguje spuštění, konfiguraci a varování při vykreslování; nevede vlastní log požadavků a nelogují se tokeny ani adresy volajících. Průchozí vrstva Penpotu loguje název každého příkazu a stavový kód odpovědi Penpotu, nikdy hlavičky, tokeny ani soubor. Certifikační služba loguje své startovací nastavení a varování konfigurace, plus dva zkrácené řádky při selhání: stavový kód selhání odeslání bez adresy příjemce a pevný řádek selhání bez textu chyby, stack trace či URL, protože chyba poskytovatele může nést hodnoty identity nebo přihlašovací údaje. Vše ostatní v logu pochází z hostingové platformy.

U lolly.tools řídí logování požadavků, rotaci a uchovávání na UpCloud správce instance. Tato stránka neuvádí maximální dobu uchovávání logů, která nebyla ověřena. Aktuální plán a jakýkoli požadavek týkající se logů držených na serveru vyřídí správce uvedený níže. U jiné instance platí nastavení jejího provozovatele, včetně případných exportů logů či dalších zpracovatelů.

## Právní základy, uchovávání a příjemci

Tato tabulka se týká referenčního nasazení **lolly.tools**. Neuvádí právní základy ani doby uchovávání instance Lolly Work tvé organizace; ty poskytuje její provozovatel ve vlastních zásadách.

| Zpracování | Právní základ (GDPR čl. 6) | Uchováváno |
|---|---|---|
| Vše na tvém zařízení (dokumenty, předvolby, cache, počítadla) | **Vůbec nejde o naše zpracování**: nikdy se k nám nedostane. Úložiště na tvém zařízení je přísně nezbytné pro službu, o kterou jsi požádal (e-soukromí čl. 5 odst. 3), takže nevyžaduje souhlas | Dokud to nesmažeš |
| Tvá e-mailová adresa při zápisu starších hostovaných Content Credentials | **Čl. 6 odst. 1 písm. b)**, plnění služby, o kterou jsi výslovně požádal | Žádný inventář identit ani log vydávání ve starší službě; e-mail se použije během požadavku a je zahrnut v tvém certifikátu. Spravované PKI organizace, audit a uchovávání odvolání se řídí politikou jeho provozovatele |
| Pseudonymní digest SHA-256 vytvořený z tvé IP adresy pro omezování frekvence přihlašovacích endpointů a veřejných endpointů vykreslení, obrázků a MCP | **Čl. 6 odst. 1 písm. f)**, náš oprávněný zájem předcházet zneužití bezplatné služby a e-mailové kvóty třetí strany. Domníváme se, že obstojí v testu proporcionality, protože omezovači se nepošle surová adresa, digest se používá jen ke kontrole zneužití a sám vyprší | Asi jednu minutu v úložišti kontroly zneužití; poté se neuchovává |
| Přístupové logy hostingu (IP, cesta, časové razítko, user agent) | **Čl. 6 odst. 1 písm. f)**, náš oprávněný zájem na bezpečnosti služby, předcházení zneužití a diagnostice chyb | Rotace a uchovávání nakonfigurované správcem; aktuální plán zjistíš u správce |

**Příjemci.** Kategorie příjemců jsou náš poskytovatel hostingu (UpCloud), který hostuje databázi aplikace a úložiště pro kontrolu zneužití, a, jen pokud použiješ přihlášení e-mailem, poskytovatel transakčních e-mailů (Resend). Úložiště pro kontrolu zneužití dostává jen krátkodobé digesty, nikdy surovou IP adresu. Pokud se přihlásíš přes GitHub, Google nebo SUSE (id.suse.com), jednáš přímo s tímto poskytovatelem podle jeho zásad ochrany soukromí a on nám sdělí ověřenou e-mailovou adresu a nic dalšího. Osobní údaje nesdílíme s nikým dalším, data neprodáváme, neprovozujeme reklamu a neprofilujeme uživatele.

**Předávání mimo EHP.** Hosting, databáze a úložiště souborů referenční aplikace jsou ve Frankfurtu. Volitelní poskytovatelé identity, e-mailu a assetů mají vlastní místa zpracování a podmínky, které mohou zahrnovat přístup mimo EHP, a samotný region serveru neurčuje jurisdikci každého příjemce. O smlouvách s poskytovateli a ujednáních o předávání se informuj u správce; u jiné instance se zeptej jejího provozovatele. [Standardní smluvní doložky](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) Evropské komise jsou jednou z dostupných záruk pro taková předávání; tato stránka netvrdí, že neověřená smlouva s poskytovatelem je používá.

**Automatizované rozhodování.** Žádné. Neprobíhá profilování ani automatizované rozhodování s právními nebo obdobně významnými účinky (čl. 22).

## Ochrana soukromí dětí

Běžné místní používání aplikace neposílá na lolly.tools žádný osobní obsah. Jeho volitelný zápis Content Credentials přijímá e-mailovou adresu a není určen dětem ani na ně zaměřen. Služby organizace mají vlastní účty a nakládání s daty podle zásad jejich provozovatele.

## Tvá práva

U záznamů uložených jen na tvém zařízení můžeš data získat, opravit, smazat a přenést sám. Jsou v úložišti tvého prohlížeče nebo aplikace, ve formě, kterou můžeš prohlédnout, exportovat (**Export my data**, výše) nebo smazat (**Clear all my data** nebo data webu v prohlížeči).

Formálně máš podle článků 15-22 GDPR právo na **přístup** ke svým osobním údajům, na jejich **opravu**, **výmaz**, **omezení** zpracování nebo vznesení **námitky** proti němu (včetně všeho, co zakládáme na oprávněných zájmech), na **přenositelnost údajů** a, kde zpracování stojí na souhlasu, **svůj souhlas kdykoli odvolat**, aniž by to ovlivnilo zákonnost toho, co proběhlo před odvoláním souhlasu.

Veřejná certifikační služba nevede žádný log vydávání. Infrastrukturní logy mohou obsahovat podrobnosti požadavků, takže tyto zásady neslibují, že hostingové prostředí nedrží žádné osobní údaje. Pro přístup, výmaz nebo jiný požadavek týkající se těchto záznamů kontaktuj správce; vysvětlíme, jaké záznamy existují a co lze udělat. U práce, identit, telemetrie a auditních záznamů držených organizací kontaktuj provozovatele Lolly Work, protože místní ovládací prvky exportu a mazání na tyto kopie nedosáhnou.

**Máš právo podat stížnost.** Pokud se domníváš, že jsme s tvými údaji naložili nesprávně, můžeš podat stížnost u dozorového úřadu pro ochranu údajů: v EU u úřadu ve své zemi bydliště, místa výkonu práce nebo místa, kde se domníváš, že k porušení došlo (čl. 77). Naším vedoucím dozorovým úřadem je *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) v Ansbachu v Německu. Nemusíš nás nejprve kontaktovat, ale rádi bychom dostali příležitost problém napravit.

## Změny těchto zásad

Datum nahoře se mění, kdykoli se změní tento dokument. Změna, která mění to, co opouští tvé zařízení nebo co se uchovává, dostane zde vlastní řádek místo tiché úpravy. Co se změnilo, zjistíš dotazem (níže) nebo porovnáním s [veřejným zdrojem](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29. září 2026:** upřesněna volitelná služba lolly.work, její obsah držený organizací, ověřovací cookies, telemetrie používání a auditní záznamy a oddělení místního mazání od uchovávání na serveru. Jde o stávající volitelné postupy, ne o nový požadavek na nahrávání pro místní úpravy.

**11. října 2026:** nahrazen popis vyřazeného hostingu Vercel inventářem názvů hostitelů aplikace na UpCloud, rozlišeni volitelní poskytovatelé identity a assetů a popsáno doručování podle obsahu a režim držených stažení MCP. Touto změnou se nezapíná žádné CDN třetí strany. Uchovávání logů řídí správce, ne uvedené výchozí nastavení plánu Vercel.

**22. října 2026:** opraven popis stávajícího chování. Část o rozšíření prohlížeče nyní zahrnuje okno schválení pro každý požadavek, přístup k webům žádaný po jednom webu a stahování stylopisů a ikon při čtení webu. Opraveno také: řádky Odeslat na Google Drive a Meeting Planner, poznámka o SEAL (žádná aplikace Lolly nevyhledává klíče SEAL v DNS), výchozí úroveň telemetrie používání služby organizace, obrazové nástroje MCP a aplikační logování veřejných služeb. Samotný software se nezměnil.

**23. října 2026:** zásady uspořádány podle toho, co každý požadavek spouští, a popsáno stávající chování, které dříve nepokrývaly: soukromé pozvánky ke spolupráci nesoucí adresy místní sítě, Nearby v desktopové aplikaci, Allow AI control, čtení designového systému z webu, sady emoji, místní cache vyhledávání měst v Meeting Planneru na zařízení, Koš a další záznamy, které uvádí Settings → Storage. Opraveny dvě věty: Bluesky a Discord nejsou jen pro desktop a každý hostitel, kterého si osoba zvolí pro odesílání, potřebuje schválení provozovatele ve webové i desktopové aplikaci; digest IP adresy pro omezování frekvence je pseudonymní, ne anonymní. Samotný software se nezměnil.

## Kdo je odpovědný a jak nás kontaktovat

**Správcem údajů** pro lolly.tools je:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Německo

SUSE jmenovala **pověřence pro ochranu osobních údajů**, kterého zastihneš na [privacy@suse.com](mailto:privacy@suse.com). Tuto adresu použij pro každý formální požadavek podle části "Tvá práva" výše.

Se vším o samotné Lolly, například jak funguje, proč je něco tak, jak je, nebo opravou tohoto dokumentu, se obrať na **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

U samostatně provozované nebo podnikové instance Lolly kontaktuj místo toho toho, kdo ji provozuje: provozovatel je správcem svého vlastního nasazení. SUSE a open-source projekt Lolly nedrží žádná data o nasazeních, která neprovozují.
