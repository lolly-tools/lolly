# Zásady ochrany osobních údajů

*Naposledy aktualizováno: 11. srpna 2026*

> **Krátká verze.** Dokumenty, obrázky, videa a soubory, které v Lolly vytvoříš, zůstávají
> na tvém zařízení. Pro běžné použití nejsou potřeba žádné účty, appka sama
> nepoužívá žádné cookies a v kódu není nikde žádná analytika ani sledovací prvky -
> netvrdíme jen "data nepoužíváme", opravdu v kódu nejsou. Existuje krátký, úplný
> seznam výjimek pro případy, kdy software vůbec komunikuje se sítí, a každá
> z nich je níže popsána konkrétně: co odchází, komu a kdy. Jediná výjimka, která
> se týká čehokoli osobního, je přihlášení, které musíš výslovně sám spustit.
> Pokud to není v tomto dokumentu, tak se to neděje.

## Co tyto zásady pokrývají

Lolly je open-source software - engine, několik aplikačních shellů (web, desktop,
mobil, CLI) a rozšíření prohlížeče - který si může spustit kdokoli. Tyto zásady mají dvě
části:

- <!--i:code--> **Samotný software**: co dělá a co nedělá s tvými daty, ať běží kdekoli.
  Jde o vlastnost kódu, takže to platí pro každé nasazení Lolly, naše i cizí.
- <!--i:server--> **lolly.tools**, referenční nasazení provozované SUSE: konkrétní volby
  učiněné při provozu jeho volitelných serverových částí (co se loguje, jak dlouho, kým).

Pokud používáš vlastní (self-hosted) nebo firemní instanci Lolly, chování softwaru
popsané níže platí i tak, ale za cokoli serverového odpovídá *provozovatel*
této instance - ne SUSE: jeho render endpoint, jeho MCP server,
jeho certifikační autorita pro Content Credentials, pokud nějakou provozuje. Zeptej se ho na
jeho vlastní zásady. Viz [Adopce a governance](/info/adoption-governance.html) - co provoz
Lolly obnáší.

## Aplikace: co zůstává na tvém zařízení

Webový, desktopový a mobilní shell Lolly spouští celý render engine na straně klienta.
Otevření nástroje, vyplnění vstupů, náhled i export - to vše probíhá na
tvém zařízení - žádný server se toho neúčastní a aplikace po načtení funguje offline.

**Aplikace nenastavuje žádné cookies.** Aby fungovala, uchovává malé množství dat **pouze
na tvém zařízení**, nikdy je nepřenáší:

- <!--i:sliders--> **Předvolby rozhraní** - motiv, jazyk, nastavení zvuku, velikost postranního
  panelu/přiblížení, volby řazení a zobrazení, které nápovědy pro nováčky jsi už viděl - v
  `localStorage`, aby byly dostupné dřív, než aplikace dokončí spuštění.
- <!--i:download--> **Offline mezipaměť katalogu nástrojů a náhledů assetů**, aby galerie
  fungovala bez připojení.
- <!--i:hash--> **Místní čítače využití** pro statistiky na tvé profilové kartě (kolik exportů, které
  nástroje) - malý omezený blob v `localStorage`, který nikdy nečteme my a nikam se neodesílá.
- <!--i:folder--> **Tvoje vlastní dokumenty, uložené relace, nahrané assety a fonty** - uložené
  v IndexedDB na tvém zařízení, nikdy se nenahrávají a nikdo kromě tebe je nikdy nečte.

Nic z toho se nesdílí, neprodává ani nepoužívá k tvé identifikaci či sledování. Není tu s čím
souhlasit, protože k žádnému sběru nedochází - jen toto oznámení, abys věděl, co se uchovává a kde.
Vymaž to všechno kdykoli pomocí **Profil → Clear all my data**, nebo vymazáním úložiště webu
v prohlížeči. (Podle směrnice ePrivacy čl. 5(3) úložiště, které je nezbytně nutné pro službu, o
kterou jsi požádal, nevyžaduje souhlas - jen transparentnost, kterou poskytuje tento dokument i
oznámení v aplikaci.)

![Sekce úložiště na profilové stránce na obrazovce šířky telefonu: každá kategorie dat na zařízení pojmenovaná, hned vedle s tlačítkem Clear all my data](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Tvoje vlastní záloha těchto dat - balíček `lolly-backup` vytvořený tlačítkem **Export my
data & render everything** - je soubor, který si necháváš a kontroluješ. Nikdy se nedostane na naše
servery, pokud si sám nezvolíš ho někam poslat. Viz [Přenos
dat](/info/data-transfer.html).

## Nástroje pracující na zařízení

Některé nástroje - **Strip Hidden Data**, **Compress PDF** a další nesoucí odznak
**"Runs on your device"** - pracují se souborem, který dodáš ty. Soubor se načte
do paměti v tvém prohlížeči, lokálně se zpracuje a nabídne zpět ke stažení.
Nikdy se nikam nenahrává, protože v cestě není žádný server, kam by se nahrával.
Tyto nástroje fungují offline a jejich výstup nenese žádný náš watermark ani metadata -
smyslem většiny z nich je data odstranit a chránit, ne přidávat riziko.

![Odznak, který tyto nástroje nesou: Runs on your device - nic se nenahrává](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Kdy aplikace komunikuje se sítí, v úplnosti

Tabulka níže je úplný seznam všeho, co aplikace přes síť stahuje nebo odesílá. Pokud to
tady není, aplikace to nedělá.

| Co | Co skutečně opustí tvé zařízení | Kdy (úkon, který to spustí) | Pokud to operátor zablokuje |
|---|---|---|---|
| Synchronizace katalogu nástrojů | Nic osobního - požadavek na veřejný index nástrojů a assetů Lolly, na vlastní origin aplikace | Při spuštění, poté uloženo do mezipaměti pro offline použití | Aplikace běží na uložené sadě nástrojů v mezipaměti. Přestane pouze objevovat nové nástroje |
| Nástroj, který potřebuje živá data | Cokoliv si daný konkrétní nástroj vyžádá, na hostitele uvedeného přímo v jeho vlastním popisu. Dnes je to jen vyhledávání měst v nástroji Meeting Planner, který se dotazuje `geocoding-api.open-meteo.com`, aby převedl název města na souřadnice a časové pásmo - žádný účet, žádný klíč a žádný identifikátor kromě samotného požadavku. Vstupní pole to uvádí přímo tam, kde píšeš, a každá odpověď se uloží na tvé zařízení, takže se město vyhledá jen jednou | Jen při používání daného nástroje, a jen poté, co zadáš lokaci | To jedno vyhledání selže. Souřadnice můžeš stále zadat ručně a nic dalšího to neovlivní |
| Google Fonts | Název zvolené rodiny písma a tvá IP adresa, na servery Google s písmy (`fonts.googleapis.com` pro styly, `fonts.gstatic.com` pro soubor s písmem) | Jen pokud přidáš Google Font v editoru značky, **a jen poté, co s tím souhlasíš v dialogu, který přesně toto říká** - jednorázové stažení pro každou rodinu, poté zůstává na tvém zařízení a používá se offline | Výběr Google Fonts selže bezpečně - zůstane zablokovaný. Místo toho nahraj soubor s písmem |
| Send to Google Drive | Ten jeden soubor, který ses rozhodl odeslat, na Google Drive API (`www.googleapis.com`), po přihlášení přes Google, které dokončíš ve vlastním vyskakovacím okně Google. Přístup Lolly je omezen na soubory, které sama vytvořila (rozsah `drive.file` - nikdy nemůže číst zbytek tvého Disku), a přihlašovací token je držen v paměti jen po dobu relace, nikdy se neukládá | Jen když stiskneš "Send to Google Drive" u exportu EMF, a jen ve verzích, kde operátor nakonfiguroval Google client id - bez něj tlačítko neexistuje | Tlačítko se nikdy nezobrazí. Soubor si stáhni a na Disk nahraj sám |
| Send to Dropbox | Ten jeden soubor, který ses rozhodl odeslat, na Dropbox API (`api.dropboxapi.com` pro přihlášení a metadata, `content.dropboxapi.com` pro samotný soubor), po přihlášení přes Dropbox, které dokončíš ve vlastním okně Dropboxu. Přístup Lolly je omezen jen na složku aplikace (vidí jen `Apps/` a svou vlastní složku v ní - nikdy zbytek tvého Dropboxu), odkaz "Open", který ti ukáže, je krátkodobý soukromý odkaz (nevytváří se žádné veřejné sdílení) a obnovovací token se uloží jen pokud zaškrtneš "stay connected" | Jen když stiskneš "Send to Dropbox" u souboru, a jen ve verzích, kde operátor nakonfiguroval Dropbox client id - bez něj tlačítko neexistuje | Tlačítko se nikdy nezobrazí. Soubor si stáhni a do Dropboxu nahraj sám |
| Send to OneDrive | Ten jeden soubor, který ses rozhodl odeslat, na identitní a Graph služby Microsoftu (`login.microsoftonline.com` pro přihlášení, `graph.microsoft.com` pro nahrání; velký soubor se nahrává po částech na nahrávací adresu vlastněnou Microsoftem na `api.onedrive.com`, `*.up.1drv.com` nebo `*.sharepoint.com`), po přihlášení přes Microsoft, které dokončíš ve vlastním okně Microsoftu. Přístup Lolly je omezen na vlastní složku pod `Apps/` (nikdy nemůže číst zbytek tvého OneDrive) plus tvé zobrazované jméno pro popisek účtu, a obnovovací token se uloží jen pokud zaškrtneš "stay connected" | Jen když stiskneš "Send to OneDrive" u souboru, a jen ve verzích, kde operátor nakonfiguroval Microsoft client id - bez něj tlačítko neexistuje | Tlačítko se nikdy nezobrazí. Soubor si stáhni a do OneDrive nahraj sám |
| Send to LinkedIn | Ten jeden soubor, který ses rozhodl odeslat, plus jeho název jako text příspěvku, na LinkedIn (`www.linkedin.com` pro přihlášení, `api.linkedin.com` pro nahrání a příspěvek), po přihlášení přes LinkedIn, které dokončíš ve vlastním prohlížeči. Příspěvek jde do tvého vlastního feedu jako veřejný příspěvek pod tvým jménem. Lolly může přispívat za tebe a číst tvé jméno pro popisek účtu, nic jiného na tvém LinkedIn, a přihlášení zůstává na tomto zařízení jen pokud zaškrtneš "stay connected" - tokeny LinkedIn vydrží 60 dní a nelze je tiše obnovit, takže samy vyprší | Jen když stiskneš "Send to LinkedIn" u souboru, jen v desktopových aplikacích, a jen ve verzích, kde je nakonfigurovaná aplikace LinkedIn - bez ní tlačítko neexistuje | Ve webové aplikaci není co blokovat: toto existuje jen **v desktopových aplikacích**, takže tyto dva hostitele úmyslně NEJSOU v Content-Security-Policy webové aplikace níže. V desktopových aplikacích odeber nakonfigurovanou aplikaci LinkedIn a tlačítko se nikdy nezobrazí |
| Tiskové profily ICC | Nic osobního - požadavek na standardní profil tiskových podmínek, na veřejný registr ICC (`registry.color.org`, `www.color.org`) | Jen pokud klikneš na přednastavení ICC ve správci tiskových profilů - jednorázové stažení pro každý profil, poté zůstává na tvém zařízení | Přednastavení ICC selžou. Místo toho dodej vlastní profil `.icc` |
| Internetové rádio | Nic osobního - požadavek na playlist a audio stream, na stanici (`api.somafm.com` a icecast server, který uvádí, `*.somafm.com`) | Jen když přehráváš volitelné vestavěné rádio ve zvukovém přehrávači | Rádio selže. Všechny ostatní zvukové funkce dál fungují |
| URL adresa, kterou necháš nástroj zachytit | Požadavek přesně na tu webovou adresu, kterou zadáš, z nástroje pro snímky URL. Ať už je ta adresa jakákoliv. Tento hostitel není v zásadách níže, protože si ho volíš v okamžiku použití | Jen když zadáš URL do daného nástroje a spustíš zachycení | Operátor to nemůže povolit podle hostitele. Pro odstranění musí odstranit nástroj |
| Kontrola podpisu SEAL | **Nic.** Webová aplikace nemá žádný DNS resolver - viz níže | Nikdy | Není co blokovat |
| AI modely na zařízení | Nic osobního - jednorázové stažení souboru modelu z hostitele modelů Lolly (`lolli.li`), poté uloženo do mezipaměti na tvém zařízení; žádný účet, žádný identifikátor, jen požadavek a tvá IP | Jen když použiješ funkci, která potřebuje model (hloubkové skenování Verify, zvětšení obrázku, řeč a podobné) | Daná funkce počká na stažení; všechno ostatní dál funguje |
| Vzdálená instance | Cokoliv ti daná instance, kterou pojmenuješ, vrátí, přes stejnou synchronizaci katalogu popsanou výše - plus verzní značka u požadavků na ni (druh shellu a verze enginu, stejná informace, jakou nese user agent), takže její operátor vidí, které verze Lolly jsou v provozu. Na spravované instanci, pokud jsi přihlášen, ta značka navíc nese instalační id pro dané zařízení, takže seznam zařízení operátora dokáže tuto instalaci rozlišit. Jede jen na požadavcích, které tvé vlastní použití už dělá - není tu žádný časovač a nic se sám od sebe neozývá - a opuštění instance id smaže, takže zařízení, které se později znovu připojí, předloží nové. Hostitele si volíš v okamžiku použití, takže není v zásadách níže | Jen pokud shell výslovně nasměruješ na jiné nasazení Lolly | Přepnutí instance selže. Tvá lokální instance zůstane nedotčena |

Každý pevný hostitel v této tabulce je zároveň úplným allowlistem v
Content-Security-Policy aplikace, kterou vynucuje prohlížeč. Seznam tedy
není jen popisem toho, co kód dělá dnes, je to hranice, ke které prohlížeč
aplikaci váže: budoucí změna, která by se pokusila kontaktovat nějakého
jiného hostitele, by byla zablokována, ne tiše povolena. Jeden řádek je
záměrnou výjimkou a jeho vlastní buňka to uvádí: Send to LinkedIn existuje
jen v desktopových aplikacích, takže zásady webové aplikace nejmenují ani
jednoho z jejích hostitelů - webová aplikace by je nedosáhla, ani kdyby se
o to její kód pokusil. Další dva řádky nemají pevného hostitele, protože si
adresu volíš v okamžiku použití: URL adresa, kterou necháš nástroj zachytit,
a vzdálená instance, na kterou nasměruješ shell. Žádný z nich není v
zásadách a každý nastane jen tehdy, když adresu zadáš a jednáš podle ní.
Nasazení, které nechce žádnou z volitelných možností (řekněme podniková
instance s vlastními písmy), odebere tyto hostitele ze svých zásad a dané
funkce pak selžou bezpečně, místo aby se ozývaly ven.

Nic z toho neposílá tvoje dokumenty, projekty, relace ani nahrané soubory nikam.
Existují proto, aby ti přinesly věci *na* zařízení (nástroje, fonty, modely), nikdy aby
posílaly věci *z* něj, s výjimkami výslovně uvedenými v sekcích níže.

**Poznámka k tomu, co jsme odstranili.** Verify umí zkontrolovat podpisy SEAL, schéma, kde
je podpisový klíč souboru zveřejněný v DNS. Prohlížeče neumí dělat DNS dotazy, takže jakákoli
webová implementace musí vyhledávání směrovat přes resolver DNS-over-HTTPS třetí strany -
což by tomuto provozovateli ukázalo kontrolovanou doménu plus tvoji IP adresu. Dřív jsme
používali resolver Cloudflare. **Už ho nepoužíváme a náhrada neexistuje**: webová aplikace
teď nepředává žádný resolver vůbec, takže ověřování SEAL tady nedělá žádné síťové požadavky.
Soubory, jejichž záznam SEAL nese klíč přímo v sobě, se dál ověřují úplně offline. Soubory,
jejichž klíč žije v DNS, hlásí "no key resolver" místo toho, a ty je můžeš zkontrolovat v
desktopové nebo příkazové aplikaci, které DNS rozlišují nativně přes tvůj vlastní počítač bez
zapojení třetí strany.

![Obrazovka Verify: cíl pro přetažení a nic víc - soubor se kontroluje tam, kde už je, bez nahrávání a bez účtu](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Můžeš si to ověřit sám: greppovatelné kontroly k tomuto i každému
dalšímu tvrzení na této stránce, s přesnými příkazy a očekávaným výstupem, najdeš na
[Ověř si to sám](/info/verify-yourself.html).

## Hot-linkované render URL

> **Na lolly.tools naostro.** Každá
> URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` se opravdu vykreslí, a vstupy
> cestují přímo v té URL. Sekce níže popisuje, co to pro tebe znamená, a
> provozovatel může tuto funkci na své vlastní instanci vypnout.

Samotná aplikace zůstává celá na tvém zařízení. Provozovatel může samostatně povolit
**hot-link render URL** - `/tool/<tool-id>.<ext>?<inputs>` - aby se sdílený odkaz Lolly
mohl objevit jako živý obrázek v README, na wiki nebo na dashboardu. Stažení takové URL
požádá server, aby vykreslil **veřejná data nástroje a katalogu** se vstupy zapsanými
v URL.

- <!--i:usercheck--> **Žádné účty, žádné cookies, žádný stav.** Endpoint je anonymní a nic
  na tvém zařízení se nečte. Tvoje dokumenty, relace a nahrané soubory nikdy neopustí
  tvůj prohlížeč - v těchto odkazech se vůbec nemohou objevit.
- <!--i:document--> **Ale samotná URL adresa se zaznamenává.** Query řetězec URL je součástí
  žádosti, takže se objeví v běžných přístupových logách hostingové platformy stejně
  jako každá požadovaná cesta. Pokud vstupy odkazu obsahují něčí jméno nebo e-mail -
  jmenovku, e-mailový podpis - **tento text skončí v těchto logách**, a žádná
  formulace zásad to nezmění. Hot-linkovaná URL adresa je proto špatné místo pro osobní údaje: dávej do ní jen
  to, co bys dal na veřejnou stránku.
- <!--i:globe--> **Vstupy jsou svou podstatou veřejné** stejně tak - jsou to cokoli, co
  autor odkazu napsal do URL adresy, čitelné pro kohokoli, koho odkaz zasáhne. Nedávej
  tajné informace do sdíleného odkazu. Lolly nabízí šifrování odkazů pro citlivý obsah.
- <!--i:eyeoff--> Odpovědi jsou **ukládány do mezipaměti a omezovány rychlostí** jako každý veřejný obrázek a označené
  jako `noindex`, takže je vyhledávače neindexují.

Provozuješ Lolly sám (self-hosting) a nechceš veřejný render povrch? Nastav
`LOLLY_DISABLE_RENDER_GET=1` a každá
tato URL vrátí 404.

## MCP server (volitelný, pro AI agenty)

Lolly lze také oslovit AI agentem přes Model Context Protocol - endpoint provozovaný
provozovatelem (lolly.tools jeden provozuje; kdokoli si může spustit vlastní,
včetně plně air-gapovaného). Sdílí bezúčtový postoj render cesty,
plus tři nástroje, které nutně pracují s bajty souborů:

- <!--i:cpu--> **`lolly_transform`** (spustí nástroj pracující na zařízení na straně serveru
  jménem volajícího agenta), **`lolly_verify`** (zkontroluje Content Credentials) a **`lolly_redact`**
  (začerní oblasti obrázku nebo PDF) - všechny přijímají
  bajty souboru od volajícího. Zpracovávají se **v procesu, v paměti**,
  a výsledek se vrátí v témže volání - soubor se nikdy nezapíše
  na disk a nikdy se neukládá po dokončení požadavku.
- <!--i:checklist--> Každý další nástroj - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - pracuje jen s parametry (text, čísla, barvy,
  URL, id assetů katalogu), stejnými vstupy, jaké přijímá hot-link render URL.
- <!--i:lock--> Přístup je buď sdílený token, který provozovatel vydává klientům, kterým důvěřuje,
  nebo bezstavové OAuth 2.1: krátkodobé podepsané tokeny ověřované proti sdílenému
  tajemství, nic se neukládá na straně serveru a samotný token se nikdy nezapíše do
  logu ani do render URL.

## Identita Content Credentials (přihlášení, které musíš zahájit sám)

Lolly umí do tvých exportů zapečetit kryptografický **Content Credential**, díky kterému může kdokoli offline ověřit, že se soubor od opuštění Lolly nezměnil. To je **ve výchozím nastavení zapnuté a zcela lokální** - podepisovací klíč se generuje na tvém zařízení a samotné podepisování probíhá offline. Bez registrace je tento klíč jednorázový: pro každý export se vytvoří nový pár klíčů, který se s ním i zahodí. Jakmile se zaregistruješ, klíč se stane trvalým a generuje se jako **neexportovatelný** - ani samotný kód Lolly ho nedokáže přečíst, může ho pouze požádat o podpis. V obou případech tvé zařízení nikdy neopustí. Tahle část popisuje jediný *volitelný* krok navíc: registraci ověřené identity, díky které tvé exporty říkají "Ověřeno - podepsáno \<your email\>" místo anonymního klíče. **Pokud registraci přeskočíš, nic z této části se tě netýká a žádná osobní data tvé zařízení nikdy neopustí.**

![Karta Verified identity na profilové stránce, šířka telefonu: výběr platnosti certifikátu a pod ním krok registrace, klidný, dokud ho sám nespustíš](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Pokud se zaregistruješ, přesně tohle se stane:

1. **Zvolíš si způsob přihlášení** - GitHub, Google, SUSE (id.suse.com) nebo odkaz
   zaslaný e-mailem. U tří poskytovatelů OIDC jsi přesměrován na přihlašovací stránku
   daného poskytovatele, řízenou jeho vlastními zásadami ochrany osobních údajů, ne našimi.
   Certifikační služba Lolly zpět dostane jen ověřenou e-mailovou adresu a
   jméno poskytovatele. U odkazu přes e-mail se adresa, kterou zadáš, předá
   službě **Resend**, transakčnímu e-mailovému API, výhradně pro doručení toho jednoho odkazu.
2. **Krátkodobý cookie chrání přesměrování.** Toto je jediný cookie, který v celém
   systému Lolly nastavujeme: `lolly_ca_state`, `HttpOnly`, omezený na `/api/ca`,
   platný do deseti minut. Nese náhodnou hodnotu, ne sledovací identifikátor, a existuje
   jen proto, aby zabránil zfalšování přesměrování OAuth. Smaže se hned po dokončení
   přihlášení.
3. **Tvoje IP adresa se krátce používá k zabránění zneužití** přihlašovacích
   endpointů (aby jeden skript nemohl zahltit schránku nebo vyčerpat e-mailovou kvótu) - drží
   se jen v paměti serveru, po klouzavém okně asi minuty, nikdy se nezapisuje
   do logu ani nikde neukládá.
4. **Certifikační služba vydá krátkodobý certifikát** (7, 30, 90 nebo 365
   dní, na tvoji volbu, omezeno zásadami provozovatele), který váže tvůj ověřený
   e-mail na veřejnou polovinu páru klíčů vygenerovaného na tvém zařízení. Soukromá
   polovina nikdy neopustí tvůj prohlížeč.
5. **O vydání se nic nezaznamenává.** Certifikační služba nevede žádný log vydávání:
   ani tvůj e-mail, ani poskytovatele, ani sériové číslo, ani časové razítko. Žádná databáze, žádný
   řádek logu, žádný webhook. Tvoje e-mailová adresa existuje v požadavku jen tak dlouho,
   dokud se nezapíše do certifikátu, který dostane tvoje vlastní zařízení, a pak je z naší strany
   úplně pryč.
6. **Poté je podepisování zase offline** po celou dobu platnosti certifikátu.
   Export souboru certifikační službu nikdy nekontaktuje - jen registrace ano.

**Kompromis, řečeno na rovinu.** Dřívější verze této služby každé vydání logovala,
aby bylo možné vystopovat chybně vydaný nebo kompromitovaný certifikát. Odstranili jsme to,
protože ten log byl jediné místo v celém Lolly, kde osobní data spočinula na serveru,
a raději je nemáme, než abychom je pečlivě drželi. Vzdáváme se tím sledovatelnosti na
straně serveru: pokud se certifikát zneužije, nemůžeme dohledat, kdo ho získal. Certifikáty
jsou záměrně krátkodobé - 7 až 365 dní, na tvoji volbu, omezeno provozovatelem - a
sama vyprší, což je zmírnění, na které místo toho spoléháme. Provozovatelé vlastní instance,
jejichž vlastní povinnosti vyžadují záznam auditu, si ho mohou přidat a stát se tím správcem
těchto dat.

## Rozšíření prohlížeče

Rozšíření prohlížeče **Lolly URL Screenshot** nesbírá, neukládá ani nepřenáší
žádná osobní data. Žádná analytika, žádné sledování, žádný vzdálený server.

**Co to dělá.** Když požádáš webovou aplikaci Lolly, aby vyfotila snímek obrazovky URL, rozšíření
otevře danou stránku v dočasné pozadí kartě, zachytí ji ve tvém prohlížeči
pomocí protokolu DevTools, předá obrázek zpět aplikaci a kartu zavře.
Všechno se odehrává lokálně, na tvém vlastním zařízení a síti.

**Data.**

- <!--i:shieldcheck--> **Nesbíráme nic.** Rozšíření nemá žádné servery a nevytváří žádné vlastní síťové
  požadavky.
- <!--i:photos--> **Zachycené obrázky** jdou přímo do aplikace Lolly ve stejném prohlížeči - nikdy je
  rozšíření nikam nenahrává.
- <!--i:link--> **URL, které zachytíš** se použijí jen k načtení té jedné stránky pro ten jeden
  snímek obrazovky. Nezaznamenávají se ani nesdílejí.

**Oprávnění.**

- <!--i:wrench--> **`debugger`** - k zachycení vykreslené stránky přes protokol DevTools (stejný
  mechanismus, jaký používá desktopová aplikace Lolly).
- <!--i:monitor--> **`tabs`** - k otevření a zavření dočasné karty, ve které se stránka načte.
- <!--i:globe--> **Přístup k hostitelům (`<all_urls>`)** - protože stránka, kterou se rozhodneš zachytit,
  může být na jakémkoli webu. Chrome to při instalaci zobrazí jako široké
  varování o oprávnění. Rozšíření ale vždy navštíví jen URL, kterou mu zadáš.

Nic z toho se nepoužívá ke čtení, sledování ani přenosu tvého prohlížení nad rámec
toho jednoho požadovaného zachycení.

## Infrastrukturní logy

Stejně jako u kteréhokoli webu servery za lolly.tools - a za jakýmkoli nasazením
Lolly - generují standardní přístupové logy webového serveru pokaždé, když k nim vůbec
dorazí požadavek: IP adresa, požadovaná cesta, časové razítko, user agent. To je
základní chování hostingu, ne něco, co Lolly přidává navrch, a nikdy neobsahuje
obsah tvých dokumentů, protože ten se k serveru vůbec nedostane. Jedinou záměrnou
výjimkou je soubor, který výslovně předáš volání MCP
`lolly_transform`, `lolly_verify` nebo `lolly_redact`, které se zpracuje v paměti a nikdy se
nezapíše na disk ani do logu, jak je popsáno výše.

**Vlastní kód Lolly do těchto logů nic nezapisuje.** Server MCP neobsahuje žádné
logovací příkazy. Certifikační služba vypíše přesně dva řádky, oba jen při selhání a oba
záměrně ořezané: stavový kód selhání odeslání bez adresy příjemce a chybovou
zprávu bez stack trace nebo URL (stack trace by mohl nést registrační token). Všechno
ostatní v logu patří hostingové platformě, ne nám.

Pro lolly.tools je hostingem Vercel a doba uchovávání přístupových logů se řídí
vlastními výchozími hodnotami platformy Vercel pro náš tarif. Nekonfigurujeme žádný odvod logů, žádný
dlouhodobý export logů ani žádný produkt pro analytiku nebo monitoring navrch. Sami
nedržíme žádnou kopii těchto logů, což také znamená, že je pro tebe nemáme jak
prohledat - viz [Tvá práva](#your-rights).

## Právní základy, uchovávání a příjemci

Skoro nic tady nepotřebuje právní základ, protože skoro nic se nezpracovává. Pro
úplnost celý seznam:

| Zpracování | Právní základ (GDPR čl. 6) | Uchováváno po dobu |
|---|---|---|
| Všechno na tvém zařízení (dokumenty, předvolby, cache, čítače) | **Vůbec ne naše zpracování** - k nám se to nikdy nedostane. Ukládání na tvém zařízení je nezbytně nutné pro službu, kterou jsi požádal (ePrivacy čl. 5(3)), takže nepotřebuje souhlas | Dokud to nesmažeš |
| Tvá e-mailová adresa během registrace Content Credentials | **Čl. 6(1)(b)**, plnění služby, kterou jsi výslovně požádal | Neuchovává se. Přítomná v paměti jen po dobu trvání požadavku |
| Tvá IP adresa na přihlašovacích koncových bodech, pro omezení rychlosti | **Čl. 6(1)(f)**, náš oprávněný zájem na prevenci zneužití bezplatné služby a e-mailové kvóty třetí strany. Považujeme to za úspěšné vyvážení zájmů, protože je to jen v paměti, nikdy se to nezapisuje a zahazuje se to zhruba do minuty | ~1 minuta, v paměti serveru, nikdy se neukládá trvale |
| Přístupové logy hostingu (IP, cesta, časové razítko, user agent) | **Čl. 6(1)(f)**, náš oprávněný zájem na bezpečnosti služby, prevenci zneužití a diagnostice chyb | Výchozí hodnota platformy Vercel pro náš tarif. Nepřidáváme žádný odvod ani export |

**Příjemci.** Kategorie příjemců jsou: náš poskytovatel hostingu (Vercel
Inc.) a - pouze pokud použiješ možnost přihlášení e-mailem - poskytovatel
transakčních e-mailů (Resend). Pokud se přihlásíš přes GitHub, Google nebo SUSE (id.suse.com),
jednáš s daným poskytovatelem přímo podle jeho vlastních zásad ochrany soukromí. Nám sdělí
ověřenou e-mailovou adresu a nic jiného. Osobní údaje nesdílíme s nikým
jiným a data neprodáváme, neprovozujeme reklamu ani neprofilujeme uživatele.

**Přenosy mimo EHP.** Vercel a Resend jsou americké společnosti. Výpočetní výkon funkcí
pro lolly.tools je pevně vázán na region Vercel Frankfurt (`fra1`), takže
zpracování probíhá v EU, ale jako poskytovatelé se sídlem v USA mohou k datům
stále přistupovat jako zpracovatelé z USA. Tyto přenosy se opírají o standardní
smluvní doložky Evropské komise a/nebo o rámec EU-US Data Privacy
Framework, jak je stanoveno ve smlouvě o zpracování dat každého poskytovatele. Protože
osobní údaje, které se k oběma poskytovatelům dostanou, jsou tak omezené - e-mailová adresa
předaná k odeslání jedné zprávy a běžné přístupové logy - je odpovídajícím způsobem
malé i vystavení riziku.

**Automatizované rozhodování.** Žádné. Neprobíhá žádné profilování ani automatizované
rozhodování s právními nebo podobně významnými účinky (čl. 22).

## Ochrana soukromí dětí

Lolly vědomě nesbírá osobní údaje od nikoho, v jakémkoli věku, při běžném používání
aplikace - není co sbírat. Jediné místo, kde se osobní údaje (e-mailová adresa) vůbec
shromažďují, je registrace Content Credentials popsaná výše, která není určena ani zamýšlena
pro děti.

## Tvá práva

Protože skoro všechno, čeho se Lolly dotkne, se ukládá jen na tvém vlastním zařízení, většina
toho, co právo na ochranu osobních údajů nazývá "tvá práva" - přístup, oprava, výmaz,
přenositelnost - jsou věci, které už dokážeš udělat sám, okamžitě, aniž bys musel kohokoli žádat:
tvá data žijí v úložišti tvého prohlížeče, ve formě, kterou můžeš prozkoumat,
exportovat (**Export my data & render everything**, výše) nebo smazat (**Profile → Clear all
my data**).

Formálně máš podle článků 15-22 GDPR právo na **přístup** ke svým
osobním údajům, na jejich **opravu**, na jejich **výmaz**, na **omezení**
nebo **vznesení námitky** proti jejich zpracování (včetně námitky proti čemukoli, co
zakládáme na oprávněných zájmech), na **přenositelnost údajů** a - tam, kde se zpracování opírá
o souhlas - na to, abys **tento souhlas kdykoli odvolal**, aniž by to ovlivnilo
zákonnost toho, co se stalo před jeho odvoláním.

Tady je upřímný postoj k uplatnění těchto práv vůči nám. Protože už neuchováváme
log vydávání, **nemáme o tobě žádné osobní údaje, které bychom mohli vyhledat,
opravit, exportovat nebo smazat.** Pokud nám napíšeš a zeptáš se, co o tobě máme,
pravdivá odpověď zní nic, a to ti také řekneme. Jedinou kategorií, která vůbec existuje,
jsou přístupové logy hostingu vázané na IP adresu, uchovávané naším poskytovatelem hostingu
podle jeho výchozích dob uchovávání. Nemáme možnost je prohledávat ani selektivně
mazat, a raději ti to řekneme, než abychom to předstírali. Všechno, co je opravdu
*tvoje*, je na tvém zařízení, kde si to už teď můžeš přečíst, exportovat
a zničit, aniž bys musel kohokoli žádat o svolení.

**Máš právo si stěžovat.** Pokud si myslíš, že jsme s tvými daty zacházeli
nesprávně, můžeš podat stížnost u dozorového úřadu pro ochranu osobních
údajů - v EU u úřadu v zemi svého bydliště, místa výkonu práce nebo místa, kde se
podle tebe k porušení došlo (čl. 77). Naším vedoucím dozorovým úřadem je *Bayerisches
Landesamt für Datenschutzaufsicht* (BayLDA) v Ansbachu v Německu. Nemusíš nás
kontaktovat nejdřív, i když bychom rádi dostali šanci to napravit.

Data neprodáváme. Ani žádná k prodeji nemáme.

## Změny těchto zásad

Datum nahoře se mění pokaždé, když se změní tento dokument. Změna, která ovlivní,
co opustí tvé zařízení nebo co se uchovává, dostane svůj vlastní řádek tady, ne tichou
úpravu - pokud chceš vidět, co se změnilo, zeptej se (níže) nebo porovnej se
[veřejným zdrojem](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Kdo je odpovědný a jak nás kontaktovat

**Správcem údajů** pro lolly.tools je:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Německo

SUSE jmenovala **pověřence pro ochranu osobních údajů**, dostupného na
[privacy@suse.com](mailto:privacy@suse.com). Tuto adresu použij pro jakoukoli formální
žádost podle "Tvá práva" výše.

S čímkoli ohledně samotné Lolly - jak funguje, proč je něco tak, jak je, nebo
oprava tohoto dokumentu - kontaktuj **Andyho Fitzsimona**,
[fitzy@suse.com](mailto:fitzy@suse.com).

U samostatně hostované nebo firemní instance Lolly kontaktuj místo toho toho, kdo ji
provozuje: provozovatel je správcem pro své vlastní nasazení. SUSE a open source
projekt Lolly nedrží žádná data pro nasazení, která neprovozují.
