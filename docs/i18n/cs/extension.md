# Rozšíření prohlížeče

Webová stránka nemůže číst pixely jiného webu. V prohlížeči založeném na Chromium (Chrome, Edge, Brave, Arc nebo Opera, od verze Chrome 111) umožňuje bezplatné rozšíření **Lolly URL Screenshot** webové aplikaci Lolly pořizovat snímky stránek stejným způsobem jako desktopová aplikace. S nainstalovaným rozšířením:

- **[Lolly URL Screenshot](/t/url-shot)** uloží stránku, kterou jsi sestavil, jako soubor;
- webová adresa vložená do pole pro obrázek se může změnit na snímek dané stránky pomocí **Screenshot this page**;
- zdroj **Website** v [Lolly Design System Setup](/info/brand-studio.html) může přečíst jednu stránku jako základ designového systému.

Každý požadavek schvaluješ a desktopová aplikace stejné úlohy zvládne bez rozšíření.

<!--i:eti-checklist-->
## Než začneš instalovat

I bez rozšíření se **Lolly URL Screenshot** otevře a můžeš sestavit snímek. Poznámka nad ovládacími prvky nástroje říká, co chybí.

![Poznámka nástroje URL Screenshot nabízející rozšíření, která se zobrazí, když zachycení do souboru nemá hostitelské prostředí, kde by mohlo běžet](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Všechny ovládací prvky fungují bez rozšíření: cílová URL, hloubka posunu stránky, prodleva na ustálení, odsazení ořezu i přebarvení. Rozšíření potřebuje jen samotné zachycení.

![Ovládací prvky Lolly URL Screenshot s cílovou URL, hloubkou posunu stránky, prodlevou na ustálení a odsazením ořezu, všechny použitelné ještě před instalací rozšíření](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Instalace

**Z Chrome Web Store:** již brzy. Po zveřejnění se rozšíření nainstaluje jedním kliknutím.

**Načti si ho sám (pro vývojáře).** Zdrojový kód rozšíření je v repozitáři v `shells/chrome-extension/`. Krok balení vytvoří z této složky produkční balíček. Tento balíček funguje jen s Lolly na `https://lolly.tools`.

1. Spusť `pnpm run pack:chrome-extension`. Vytvoří balíček v `dist/chrome-extension/`.
2. Otevři `chrome://extensions`.
3. Zapni **Developer mode** (vpravo nahoře).
4. Klikni na **Load unpacked** a vyber složku `dist/chrome-extension/`.
5. Znovu načti kartu Lolly. Lolly zjistí přítomnost rozšíření při načtení stránky a výzva „Get the extension“ zmizí. **Lolly URL Screenshot** (v Utilities) pak může ukládat snímky do souboru a funguje v režimu Lolly Batch.

::: details Pro místní vývojový server nebo zdrojovou složku
Pro místní vývojový server spusť `pnpm run pack:chrome-extension:dev` a místo toho načti `dist/chrome-extension-dev`. Tento balíček přijímá také `http://localhost:5173` a v názvu má **Development**.

Načtení samotné složky `shells/chrome-extension/` funguje také pro snímky PNG. Tato složka neobsahuje procházení stránky, které se přidává při balení. SVG z této složky obsahuje snímek obrazovky, ne tvary.
:::

<!--i:eti-user-check-->
## Co se stane, když Lolly požádá

![Karta Lolly požádá o jednu stránku a v okně schválení rozšíření stiskneš Approve once. Otevře se karta na pozadí, přečte stránku a zavře se. Pak karta Lolly dostane výsledek.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly požádá.** Malý skript sdělí Lolly, že je rozšíření přítomné, takže zachycení nebo čtení stránky může začít bez dalšího nastavování.
2. **Ty schválíš.** Rozšíření otevře vlastní okno **Approve page request**. Ukáže žádající web, zda chce snímek obrazovky, nebo obsah stránky, a adresu stránky. Nic se nečte, dokud nestiskneš **Approve once**. **Cancel** nebo zavření okna požadavek ukončí.
3. **Chrome se zeptá jednou pro každý web.** Když poprvé schválíš požadavek pro daný web, Chrome se také zeptá, zda k němu rozšíření smí přistupovat. Jakmile přístup povolíš, Chrome ho uchová, ale každý další požadavek stále vyžaduje vlastní **Approve once**.
4. **Stránka se přečte na kartě na pozadí.** Rozšíření otevře cílovou stránku na kartě na pozadí, zachytí ji přes DevTools Protocol (stejné `Page.captureScreenshot`, jaké používá desktopová aplikace), zavře kartu a předá výsledek zpět kartě Lolly, která o něj požádala.

::: details Jak funguje zachycení do SVG
U **SVG** rozšíření prochází stránku místo pořizování snímku obrazovky. Skript zabalený s rozšířením přečte rozvržení stránky na kartě na pozadí a převede stránku na tvary a text v obrysech. Soubor zůstává ostrý v jakékoli velikosti a každá část zůstává upravitelná. Obrázky na stránce zůstávají obrázky. Vše, co stránka kreslí pomocí plátna, videa nebo efektu, který SVG nedokáže vyjádřit, se zkopíruje ze snímku obrazovky pořízeného ve stejném okamžiku. Lolly porovná výsledek s tímto snímkem. Když se příliš liší, SVG obsahuje místo toho snímek obrazovky.

Aby rozšíření převedlo text na obrysy v původním písmu stránky, předá Lolly soubory písem, které stránka načetla. Chrome neuchovává bajty písma tam, kde je rozšíření může přečíst, takže rozšíření požádá stránku o každé písmo znovu. Tvůj prohlížeč obvykle odpoví ze své mezipaměti a na tento požadavek stále platí vlastní bezpečnostní politika stránky.
:::

Schválení platí pro jeden požadavek a vyprší po 30 sekundách. Najednou může čekat nebo běžet jen jeden požadavek a schválený požadavek se zastaví po 55 sekundách. Pokud se stránka Lolly zavře nebo změní, nebo cílová stránka přejde na jiný web, požadavek se zruší.

::: warning Zachycení používá tvou relaci prohlížeče
Stránka se načítá s tvou relací prohlížeče, takže stránka, ke které jsi přihlášený, může ve výsledku zobrazit soukromé informace.
:::

Zachycení běží ve tvém prohlížeči ve tvé síti, takže `localhost` i interní weby fungují. Snímek se nikam nenahrává. Jediný síťový provoz tvoří načtení požadované stránky tvým prohlížečem a u SVG také druhé načtení souborů písem této stránky.

Během zachycení se na dočasné kartě může krátce objevit banner *„…started debugging this browser“*. Banner pochází z DevTools Protocol a po dokončení snímku zmizí.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Čtení webu pro Lolly Design System Setup

Zdroj **Website** v Lolly Design System Setup založí designový systém z webu, který už máš. V prohlížeči Chromium stránku přečte rozšíření. V desktopové aplikaci stránku načte sama aplikace. V prohlížeči bez rozšíření se karta Website nenabízí.

- **Jedna adresa, jedna stránka.** Po tvém schválení rozšíření otevře stránku na stejném druhu karty na pozadí, přečte vykreslené značkování, text stylů a několik obrázků ikon a log, pak kartu zavře. Rozšíření nesleduje odkazy ani neprochází web.
- **Styly hostované jinde** (na CDN nebo ve službě písem) se načtou také, protože obsahují barvy a písma stránky. Požadavky na jiný origin se odesílají bez tvých cookies. Požadavky na stejný origin používají tvé cookies stejně jako stránka.
- **Všechno má limit**, jak počet stylů a obrázků, tak počet bajtů, takže škodlivá nebo částečně nefunkční stránka vrátí neúplné podklady místo toho, aby se zpracování zaseklo.
- **Parsování probíhá na tvém zařízení.** Bajty jdou přímo zpět na kartu Lolly, která o ně požádala a která je převede na barvy, písma a loga.

Vložení adresy jen vyplní pole. Nic se nečte, dokud nespustíš čtení a nestiskneš **Approve once**.

<!--i:eti-lock-->
## Oprávnění

Soubor `manifest.json` rozšíření deklaruje čtyři oprávnění a k tomu přístup k webům, o který žádá pro každý web zvlášť. Nastavuje `minimum_chrome_version: 111` a aktuální verze je 0.5.0.

| Oprávnění | K čemu slouží | Kdy se uděluje |
|---|---|---|
| `debugger` | Ovládá kartu na pozadí přes DevTools Protocol, který pořizuje snímek obrazovky a u SVG spouští procházení stránky. | Při instalaci |
| `tabs` | Otevírá dočasnou kartu na pozadí a následně ji zavírá a kontroluje, že se od tvého schválení nepřesunula stránka Lolly ani cílová stránka. | Při instalaci |
| `scripting` | Spouští čtečku jedné stránky na webu, který jsi zadal, pro zdroj Website. | Při instalaci |
| `storage` | Poznamenává si ID otevřené karty pouze v úložišti relace, aby se karta zavřela i tehdy, když prohlížeč pozastaví rozšíření uprostřed čtení. Při dalším spuštění se vymaže; nic o tobě se neukládá. | Při instalaci |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Přístup k webu, neuděluje se při instalaci. Když stiskneš **Approve once**, rozšíření požádá Chrome o přístup k jedinému webu v daném požadavku. | Při prvním schválení požadavku pro daný web, poté co se tě Chrome zeptá |

Rozšíření čte jen stránku, kterou schválíš. Nečte ani neodesílá data o tvém prohlížení.

<!--i:eti-help-->
## Řešení problémů

- **Stále vidíš „Get the extension“?** Znovu načti kartu Lolly.
- **Na tomto webu se nic neděje?** Rozšíření funguje jen na `https://lolly.tools` a ve vývojovém balíčku také na `http://localhost:5173`. Jiný origin, například vlastní hostovaná kopie Lolly, potřebuje vlastní sestavení rozšíření, které tento origin uvádí v `manifest.json` i `policy.js`. Samotná úprava manifestu nestačí.
- **Zachycení selhává?** Zkontroluj, že je URL dostupná a začíná na `http://` nebo `https://`. Některé stránky blokují automatické zachycení. Pokud jsi stiskl **Cancel**, zavřel okno schválení nebo čekal déle než 30 sekund, spusť zachycení znovu.
