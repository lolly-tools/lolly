# Používej Lolly ve své organizaci

Tvá organizace může provozovat vlastní Lolly: stejnou aplikaci s nástroji a designovými systémy, které si vybrala. Tato stránka ukazuje, jak se k ní dostat, přihlásit se a co se po tom změní.

::: note Co potřebuješ od své organizace
Webovou adresu její Lolly, nebo instalační soubor `.lolly`, který tvoje organizace vytvořila. Samotné lolly.tools se s organizací nepropojuje.
:::

## V prohlížeči

Otevři adresu, kterou ti organizace dala. Pokud stránka požádá o přihlášení, stiskni **Sign in** a postupuj podle přihlašovací stránky, kterou otevře. Poté funguje jako každá Lolly, s nástroji a designovými systémy tvé organizace.

Můžeš také začít z lolly.tools: otevři **Settings** a na kartě **Lolly instance** stiskni **Open a workspace**, zadej adresu a stiskni **Open this instance**. Prohlížeč přejde na vlastní adresu tvé organizace, protože prohlížeč nemůže z lolly.tools načíst nástroje jiné Lolly.

![Karta Lolly instance v Settings, kde otevřeš pracovní prostor své organizace nebo změníš, odkud aplikace bere nástroje](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## V desktopové nebo mobilní aplikaci

Aplikace začíná s přibalenými nástroji. K připojení otevři **Settings** a na kartě **Lolly instance** stiskni **Change**. List se zeptá **Where should Lolly get its tools?**

1. Zvol **Připojit se k instanci Lolly**.
2. Zadej webovou adresu své organizace a stiskni **Zkontrolovat a připojit**.
3. Stiskni **Použít tuto instanci**. Další obrazovka, **Importuj svá data (volitelné)**, přenese uloženou práci ze zálohy Lolly; pokud žádnou nemáš, stiskni **Přeskočit**.
4. Přihlas se, pokud o to aplikace požádá.

Nástroje z připojené instance běží se stejnou důvěrou jako ty vlastní v aplikaci, takže se připojuj jen k té, které důvěřuješ. Tvoje organizace ti místo toho může poslat instalační soubor `.lolly`, který aplikaci připojí za tebe.

Pro pozdější přepnutí použij znovu **Change** nebo **Leave** na stejné kartě.

### Přihlášení kódem

V desktopových a mobilních aplikacích nabízí přihlašovací obrazovka také krátký kód, pokud Lolly tvé organizace přihlášení kódem podporuje. Stiskni **Open sign-in in browser**, přihlas se a kód tam schval. Nebo otevři zobrazenou adresu na telefonu či počítači, kde už jsi přihlášen, a zadej kód. Kód platí asi deset minut.

## Co je tam jinak

- **Některé ovládací prvky jsou nastaveny za tebe.** Ovládací prvek, který tvá organizace řídí, ukazuje **Managed by** a název organizace, nebo **Managed by your organisation**. Pevný prvek nelze měnit, nabídka může obsahovat jen některé své volby a řádek začínající **Set by** může říct, které pravidlo platí a proč. Některé prvky se nezobrazují vůbec.
- **Některé designové systémy jsou zamčené.** Designový systém, který dodává tvá organizace, ukazuje zámek a zůstává jen pro čtení. Chceš-li zkusit změny, vytvoř upravitelnou kopii v **Settings → Preferences → Design systems**.
- **Uvedeny jsou jen její nástroje.** Nástroj, který tvá organizace nenabízí, se nezobrazuje vůbec.
- **Sdílené projekty.** Pokud s tebou organizace sdílí projekty, **Projects** ukáže dlaždici **Team projects**. Tyto relace žijí na serveru organizace. Otevři jednu a pracuj na ní, nebo z **Share** zahaj [pracovní kolaboraci](/info/collaborate.html#work-collabs-with-lolly-work-optional), když je k dispozici.
- **Některé exporty mohou vyžadovat schválení.** Kde organizace schválení vyžaduje, **Request approval** nahradí **Download** a nástroj může nabízet méně formátů.

### Co zůstává kde

::: cols
## Na tomto zařízení

- Tvá vlastní uložení, pokud nezapneš [Sync](/info/sync.html)
- Designové systémy, které sis vytvořil sám
- Cokoli vytvoříš a stáhneš

## Na serveru tvé organizace

- Tvá přihlašovací identita a informace o zařízení
- Týmové projekty, sdílené relace a živé úpravy v pracovní kolaboraci
- Assety, které nahraješ do sdílené knihovny
- Žádosti o schválení a schválená doručení
- Události používání, kde je tvá organizace zapne
:::

[Soukromí](/info/privacy.html#organisation-services-with-lolly-work) uvádí, co server ukládá a kdo ta data řídí.

## Co Lolly Work přidává

Server tvé organizace provozuje **Lolly Work**, organizační software téhož open-source projektu. Aplikace nepotřebuje ani pracovní účet, ani Lolly Work, když ji používáš sám.

::: details Co Lolly Work může přidat
Tvá organizace hostuje [Lolly Work](https://github.com/lolly-tools/lolly-work) vedle Lolly a vybírá, které funkce zapne:

- **Přihlášení a přístup.** Jednotné přihlášení organizace, oprávnění podle skupin a spravovaná pole profilu. Správci mohou účty zřizovat a deaktivovat přes SCIM.
- **Sdílená práce.** Týmové projekty, sdílené relace a [pracovní kolaborace](/info/collaborate.html#work-collabs-with-lolly-work-optional) s živými úpravami přes server organizace.
- **Sdílená knihovna assetů.** Nahrané assety, kolekce a připojené knihovny s pravidly přístupu, verzemi a revizí.
- **Revize a doručení.** Kroky schvalování, spravované odkazy s platností nebo odvoláním a doručení do cílů, které organizace povolí.
- **Správa.** Hlášení používání podle politiky telemetrie instance plus auditní záznam řízených akcí.

Pokud službu zřizuješ, začni [Nasazením](/info/deployment.html#organisation-services-with-lolly-work). Veřejné demo na [lolly.work](https://lolly.work) je pískoviště; pro práci, kterou potřebuješ uchovat, použij vlastní adresu své organizace.
:::

## Opuštění

**Leave** na kartě **Lolly instance** v **Settings** odstraní designový systém, nástroje a katalog tvé organizace. Tvá vlastní práce zůstane. Cokoli jsi s jejími nástroji vytvořil, se znovu neotevře, dokud se nepřipojíš zpět.

Cokoli jsi uložil do organizace, zůstává u organizace podle jejích zásad přístupu a uchovávání. Opuštění nebo vymazání tohoto zařízení tu kopii na serveru nesmaže. V prohlížeči na vlastní adrese tvé organizace není co opouštět: otevři místo toho jinou adresu.

## Koho se zeptat

Co se dostane na server tvé organizace, kdo může vidět její sdílené projekty a která nastavení jsou pevně daná, jsou rozhodnutí tvé organizace. Zeptej se toho, kdo provozuje Lolly tvé organizace. [Soukromí](/info/privacy.html) popisuje, co Lolly samotné dělá s tvými daty.
