# Rozšíření prohlížeče

Webová stránka nemůže číst pixely jiného webu, takže webová aplikace Lolly potřebuje pomoc, aby stránku zachytila. V prohlížeči založeném na Chromiu (Chrome, Edge, Brave, Arc nebo Opera, od Chrome 111) tuto pomoc poskytuje bezplatné rozšíření **Lolly URL Screenshot**, které používá stejné zachycení jako desktopová aplikace. Když je nainstalováno:

- **[Lolly URL Screenshot](/t/url-shot)** uloží stránku, kterou jsi složil, jako soubor;
- webová adresa vložená do slotu obrázku se může stát snímkem té stránky pomocí **Screenshot this page**;
- zdroj **Website** v [Lolly Design System Setup](/info/brand-studio.html) umí přečíst jednu stránku pro založení designového systému.

Každý požadavek schvaluješ ty a desktopová aplikace dělá stejné úlohy bez rozšíření.

## Před instalací

Dokud rozšíření není nainstalováno, **Lolly URL Screenshot** se stále otevře, takže můžeš složit záběr. Poznámka nahoře v ovládacích prvcích nástroje říká, co chybí.

![Poznámka nástroje URL Screenshot nabízející rozšíření, zobrazená, když snímání do souboru nemá na čem běžet](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Každý ovládací prvek funguje, zatímco čekáš: cílová URL, hloubka rolování, prodleva ustálení, oříznutí okrajů a přebarvení. Rozšíření potřebuje jen samotné zachycení.

![Ovládací prvky Lolly URL Screenshot s cílovou URL, hloubkou scrollu, prodlevou před ustálením a ořezovými okraji, vše použitelné ještě před existencí rozšíření](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalace

**Z Chrome Web Store:** brzy. Jakmile bude rozšíření zveřejněno, nainstaluješ je jedním kliknutím.

**Načti si ho sám (vývojáři).** Zdrojový kód rozšíření leží v repozitáři v `shells/chrome-extension/`. Krok balení z té složky sestaví produkční balíček, který funguje s Lolly jen na `https://lolly.tools`.

1. Spusť `pnpm run pack:chrome-extension`. Balíček sestaví do `dist/chrome-extension/`.
2. Otevři `chrome://extensions`.
3. Zapni **Developer mode** (vpravo nahoře).
4. Klikni na **Load unpacked** a vyber složku `dist/chrome-extension/`.
5. Znovu načti kartu Lolly. Detekce probíhá při načtení stránky, takže výzva "Get the extension" zmizí. **Lolly URL Screenshot** (pod Utilities) pak může ukládat zachycení do souboru a stane se dostupným v režimu Lolly Batch.

Pro lokální vývojový server spusť `pnpm run pack:chrome-extension:dev` a místo toho načti `dist/chrome-extension-dev`. Tento balíček přijímá i `http://localhost:5173` a má v názvu **Development**.

Načtení samotné složky `shells/chrome-extension/` také funguje, pro snímky PNG. Ta složka nemá průchod stránkou (ten do balíčku doplní krok balení), takže SVG z ní obsahuje snímek obrazovky, ne tvary.

## Co se stane, když se Lolly zeptá

![Karta Lolly žádá o jednu stránku a ty stiskneš Approve once v okně schválení rozšíření. Otevře se karta na pozadí, přečte stránku a zavře se. Pak karta Lolly dostane výsledek.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly se zeptá.** Malý skript sdělí Lolly, že rozšíření je přítomno, takže zachycení nebo čtení stránky může začít bez dalšího nastavení.
2. **Ty schválíš.** Rozšíření otevře vlastní okno **Approve page request**. Ukáže žádající web, zda chce snímek, nebo obsah stránky, a adresu stránky. Nic se nečte, dokud nestiskneš **Approve once**. **Cancel** nebo zavření okna žádost ukončí.
3. **Chrome se zeptá jednou na web.** Při prvním schválení žádosti pro web se Chrome také zeptá, zda smí rozšíření k tomu webu přistupovat. Chrome si ten přístup pamatuje, jakmile jej povolíš, ale každá další žádost stále potřebuje vlastní **Approve once**.
4. **Stránka se čte v kartě na pozadí.** Rozšíření otevře cílovou stránku v kartě na pozadí, zachytí ji přes protokol DevTools (stejné `Page.captureScreenshot`, které používá desktopová aplikace), kartu zavře a předá výsledek kartě Lolly, která se ptala.

U **SVG** rozšíření stránku prochází, místo aby pořídilo obrázek obrazovky. Skript zabalený s rozšířením přečte rozvržení stránky v té záložní kartě na pozadí a promění ji v tvary a text s obrysy, takže soubor zůstane ostrý v jakékoli velikosti a každá část zůstane upravitelná. Obrázky na stránce přejdou jako obrázky, kterými jsou, a to, co stránka kreslí pomocí canvasu, videa nebo efektu, pro který SVG nemá podobu, se zkopíruje ze snímku obrazovky ve stejném okamžiku. Lolly výsledek proti tomu snímku zkontroluje, a když se oba příliš liší, SVG místo toho obsahuje snímek.

Aby rozšíření vytvořilo obrysy textu ve vlastním typu písma stránky, předá Lolly soubory písem, které stránka načetla. Chrome neuchovává bajty písma tam, kde by je rozšíření mohlo číst, takže rozšíření požádá stránku o každé písmo znovu. Tvůj prohlížeč obvykle odpoví z mezipaměti a na ten požadavek se stále vztahuje vlastní bezpečnostní politika stránky.

Schválení pokrývá jednu žádost a vyprší za 30 sekund. Čekat nebo běžet může jen jedna žádost najednou a schválená žádost se zastaví po 55 sekundách. Pokud se stránka Lolly zavře nebo změní, nebo cílová stránka přejde na jiný web, žádost se zruší.

Zachycení běží v tvém prohlížeči, na tvé síti, takže `localhost` a interní weby fungují. Stránka se načte s relací tvého prohlížeče, takže stránka, k níž jsi přihlášen, může ve výsledku ukázat soukromé informace. Zachycení se nenahrává: jediný síťový provoz je tvůj vlastní prohlížeč načítající stránku, kterou jsi požadoval, plus u SVG soubory písem té stránky podruhé.

Během zachycení můžeš krátce vidět na dočasné kartě banner *"…started debugging this browser"*. To je protokol DevTools při práci a banner zmizí, až je snímek hotov.

<a id="reading-a-site-for-design-system-setup"></a>
## Čtení webu pro Lolly Design System Setup

Zdroj **Website** v Lolly Design System Setup zakládá designový systém z webu, který už máš. V prohlížeči Chromium stránku čte rozšíření. V desktopové aplikaci stránku stahuje sama aplikace. V prohlížeči bez rozšíření se dlaždice Website nenabízí.

- **Jedna adresa, jedna stránka.** Po schválení rozšíření otevře stránku ve stejném druhu karty na pozadí, přečte vykreslené značkování, text stylopisů a hrstku ikon a log, a kartu zavře. Neprochází odkazy ani procházení nedělá.
- **Stylopisy hostované jinde** (CDN nebo písmová služba) se stahují také, protože v nich žijí barvy a písmo stránky. Požadavky napříč původy jdou bez tvých cookies; požadavky ze stejného původu je používají, jako by je používala sama stránka.
- **Vše je omezeno,** s limitem na počet stylopisů a obrázků a na bajty, takže nepřátelská nebo napůl rozbitá stránka vrátí částečný materiál, místo aby se zasekla.
- **Parsování probíhá na tvém zařízení.** Bajty jdou rovnou zpět na kartu Lolly, která se ptala a která je změní na barvy, písmo a loga.

Vložení adresy jen vyplní pole. Nic se nečte, dokud nezahájíš čtení a nestiskneš **Approve once**.

## Oprávnění

`manifest.json` rozšíření deklaruje čtyři oprávnění plus přístup k webům, o který žádá po jednom webu. Nastavuje `minimum_chrome_version: 111` a aktuální verze je 0.5.0.

| Oprávnění | K čemu slouží | Kdy se uděluje |
|---|---|---|
| `debugger` | Řídí kartu na pozadí přes protokol DevTools, který pořizuje snímek a u SVG spouští průchod stránkou. | Při instalaci |
| `tabs` | Otevírá dočasnou kartu na pozadí a poté ji zavírá a ověřuje, že se od schválení nepřesunula ani stránka Lolly, ani cílová stránka. | Při instalaci |
| `scripting` | Spouští čtečku jedné stránky uvnitř webu, který jsi uvedl, pro zdroj Website. | Při instalaci |
| `storage` | Poznamenává si id karty, kterou otevřelo, jen v úložišti relace, aby se karta stále zavřela, pokud prohlížeč rozšíření uprostřed čtení pozastaví. Vymaže se při dalším spuštění; nic o tobě se neukládá. | Při instalaci |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Přístup k webům, při instalaci neudělený. Po stisknutí **Approve once** rozšíření požádá Chrome o přístup k jedinému webu v té žádosti. | Při prvním schválení žádosti pro ten web, poté co se Chrome zeptá tebe |

Rozšíření čte jen jedinou stránku, kterou schválíš. Nečte ani neodesílá data o tvém prohlížení a nic se nenahrává.

## Řešení problémů

- **Stále vidíš "Get the extension"?** Znovu načti kartu Lolly.
- **Na tomto webu se nic neděje?** Rozšíření funguje jen na `https://lolly.tools` plus `http://localhost:5173` ve vývojářském balíčku. Jiný původ, například samostatně hostovaná kopie Lolly, potřebuje vlastní sestavení rozšíření, které tento původ uvádí v `manifest.json` i `policy.js`. Úprava samotného manifestu nefunguje.
- **Zachycení selže?** Zkontroluj, že je URL dosažitelná a začíná `http://` nebo `https://`. Některé stránky automatické zachycení blokují. Pokud jsi stiskl **Cancel**, zavřel okno schválení nebo čekal déle než 30 sekund, zahaj zachycení znovu.
