# Používej Lolly ve své organizaci

Tvá organizace může provozovat vlastní Lolly: stejnou aplikaci s nástroji a designovými systémy, které si vybrala. Zjisti, jak se k ní dostat, jak se přihlásit a co se mění.

Při plánování nastavení organizace ti [Používání Lolly se stávajícím DAM](/info/use-with-dam.html) vysvětlí, jak může schválená knihovna zůstat na svém místě, zatímco lidé tvoří obsah v Lolly. [Suverenita obsahu](/info/content-sovereignty.html) popisuje širší kontrolu nad tvorbou, správou, ukládáním a přenositelností.

::: note Co potřebuješ od své organizace
Webovou adresu její Lolly nebo konfigurační soubor `.lolly`, který organizace vytvořila. Samotná adresa lolly.tools tě k žádné organizaci nepřipojí.
:::

<!--i:eti-globe-->
## V prohlížeči

Otevři adresu, kterou ti organizace dala. Pokud stránka vyžaduje přihlášení, stiskni **Sign in** a postupuj podle přihlašovací stránky, která se otevře. Pak Lolly funguje jako obvykle, s nástroji a designovými systémy tvé organizace.

Můžeš začít i na lolly.tools: otevři zobrazení **Settings**, na kartě **Lolly instance** stiskni **Open a workspace**, zadej adresu a stiskni **Open this instance**. Prohlížeč přejde na vlastní adresu tvé organizace, protože z lolly.tools nemůže načítat nástroje jiné instance Lolly.

![Karta Lolly instance v Settings, kde otevřeš pracovní prostor své organizace nebo změníš, odkud aplikace získává nástroje](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## V aplikaci pro počítač nebo mobil

Aplikace začíná s nástroji, které jsou její součástí. Pro připojení otevři zobrazení **Settings** a stiskni **Change** na kartě **Lolly instance**. Panel se zeptá **Where should Lolly get its tools?**

1. Vyber **Connect to a Lolly instance**.
2. Zadej webovou adresu své organizace a stiskni **Check & connect**.
3. Stiskni **Use this instance**. Další obrazovka **Import your data (optional)** přenese uloženou práci ze zálohy Lolly. Pokud žádnou nemáš, stiskni **Skip**.
4. Přihlas se, pokud tě aplikace vyzve.

Nástroje z připojené instance mají při běhu stejnou důvěru jako vlastní nástroje aplikace, proto se připojuj jen k instanci, které důvěřuješ. Organizace ti místo toho může poslat konfigurační soubor `.lolly`, který aplikaci připojí za tebe.

Pokud chceš později přepnout jinam, znovu použij **Change** nebo **Leave** na stejné kartě.

### Přihlášení pomocí kódu

V aplikacích pro počítač a mobil nabízí přihlašovací obrazovka také krátký kód, pokud Lolly tvé organizace přihlášení kódem podporuje. Stiskni **Open sign-in in browser**, přihlas se a potvrď tam kód. Nebo otevři adresu zobrazenou na obrazovce na telefonu či počítači, kde už jsi přihlášený, a zadej kód. Kód platí přibližně deset minut.

<!--i:eti-sliders-->
## Co je tam jinak

- **Některé ovládací prvky jsou nastavené za tebe.** Prvek spravovaný tvou organizací zobrazuje **Managed by** a název organizace nebo **Managed by your organisation**. Pevně nastavený prvek nelze změnit a nabídka může obsahovat jen některé možnosti. Některé prvky jsou skryté. Konzole tvé organizace zaznamenává, které pravidlo prvek pevně nastavilo a proč. Zeptej se toho, kdo u vás provozuje Lolly.
- **Některé designové systémy jsou zamčené.** Designový systém dodaný organizací zobrazuje zámek a zůstává jen pro čtení. Chceš-li vyzkoušet změny, vytvoř upravitelnou kopii v **Settings → Preferences → Design systems**.
- **V seznamu jsou jen její nástroje.** Nástroj, který tvá organizace nenabízí, se nezobrazuje.
- **Sdílené projekty.** Pokud s tebou organizace sdílí projekty, zobrazí **Projects** dlaždici **Team projects**. Tyto relace jsou uložené na serveru organizace. Otevři některou a pracuj na ní nebo z **Share** zahaj [pracovní spolupráci](/info/collaborate.html#collabs-through-lolly-work-optional), pokud je dostupná.
- **Některé exporty mohou vyžadovat schválení.** Tam, kde organizace požaduje schválení, nahradí **Request approval** tlačítko **Download** a nástroj může nabízet méně formátů.
- **Domovská obrazovka se může otevřít na šablonách.** Pokud ti organizace zpřístupňuje šablony, třeba jako partnerské firmě, otevře se domovská obrazovka s nimi místo úvodního uvítání. Každá šablona má jednu kartu s **Your copy** pro pokračování v práci a **New version**, když se šablona změní. Viz [Partnerské šablony](/info/work-partner-templates.html).

### Co zůstává kde

::: cols
## Na tomto zařízení

- Tvá vlastní uložená práce, pokud nezapneš [Sync](/info/sync.html)
- Designové systémy, které jsi sám vytvořil
- Všechno, co vytvoříš a stáhneš

## Na serveru tvé organizace

- Tvá přihlašovací identita a informace o zařízení
- Týmové projekty, sdílené relace a živé úpravy v pracovní spolupráci
- Assety, které nahraješ do sdílené knihovny
- Žádosti o schválení a schválená doručení
- Záznam tvých přihlášení a činností, které tam provádíš
:::

Když je pracovní prostor připojený, řádek o soukromí na první obrazovce aplikace uvádí totéž. Vlastní aplikace Lolly neposílají pracovnímu prostoru žádné události o používání. [Soukromí](/info/privacy.html#organisation-services-with-lolly-work) uvádí, co server ukládá a kdo tato data spravuje.

<!--i:eti-building-->
## Co přidává Lolly Work

Na serveru tvé organizace běží **Lolly Work**, software pro organizace ze stejného open-source projektu. Když aplikaci používáš samostatně, nepotřebuje pracovní účet ani Lolly Work.

::: details Co může Lolly Work přidat
Tvá organizace hostuje [Lolly Work](https://github.com/lolly-tools/lolly-work) vedle Lolly a vybírá funkce, které zapne:

- **Přihlášení a přístup.** Jednotné přihlašování organizace, oprávnění podle skupin a spravovaná pole profilu. Správci mohou zřizovat a deaktivovat účty přes SCIM.
- **Sdílená práce.** Týmové projekty, sdílené relace a [pracovní spolupráce](/info/collaborate.html#collabs-through-lolly-work-optional) s živými úpravami přes server organizace.
- **Sdílená knihovna assetů.** Nahrané assety, kolekce a připojené knihovny s pravidly přístupu, verzemi a kontrolou.
- **Kontrola a doručení.** Schvalovací kroky, spravované odkazy s vypršením platnosti nebo možností odvolání a doručování do cílů povolených organizací.
- **Správa.** Auditní záznam řízených akcí a přehledy používání podle zásad telemetrie instance pro klienty, kteří posílají události o používání. Vlastní aplikace Lolly dnes žádné neposílají.
:::

S nastavením služby začni u [Nasazení](/info/deployment.html#organisation-services-with-lolly-work). Veřejné demo na [lolly.work](https://lolly.work) je testovací prostředí. Pro práci, kterou potřebuješ uchovat, používej vlastní adresu své organizace.

<!--i:eti-palette-->
## Značka jiné organizace

Partner, klient nebo sponzor ti může místo adresy poslat svou značku jako soubor designového systému (`.lolly`). Otevření tohoto souboru aplikaci k ničemu nepřipojí. Soubor na tomto zařízení přidá jejich designový systém vedle tvého. Konfigurační soubor od tvé vlastní organizace připojí aplikaci k její Lolly. Než se cokoli změní, náhled ukáže, co otevření souboru provede. [Práce s partnery](/info/partners.html) popisuje obě strany práce se značkou jiné organizace.

<!--i:eti-unlink-->
## Odpojení

**Leave** na kartě **Lolly instance** v **Settings** odstraní designový systém, nástroje a katalog tvé organizace. Tvá vlastní práce zůstane. Cokoli vytvořeného jejími nástroji nepůjde znovu otevřít, dokud se nepřipojíš zpět. Pokud to Lolly tvé organizace nabízí, **Sign out everywhere** na stejné kartě ukončí tvé relace na všech zařízeních včetně tohoto.

Všechno, co jsi uložil do organizace, v ní zůstává podle jejích zásad přístupu a uchovávání. Odpojení ani vymazání tohoto zařízení serverovou kopii nesmaže. V prohlížeči na vlastní adrese organizace se není od čeho odpojovat: místo toho otevři jinou adresu.

<!--i:eti-help-->
## Koho se zeptat

O tom, co se dostane na server organizace, kdo uvidí její sdílené projekty a která nastavení jsou pevná, rozhoduje tvá organizace. Zeptej se toho, kdo u vás provozuje Lolly. [Soukromí](/info/privacy.html) popisuje, co s tvými daty dělá samotná Lolly.
