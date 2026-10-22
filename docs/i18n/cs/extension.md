# Rozšíření prohlížeče

Rozšíření **Lolly URL Screenshot** umožňuje webové aplikaci vyfotit libovolnou webovou stránku přímo z prohlížeče. Bez něj potřebuje snímání URL desktopovou aplikaci - stránka v prohlížeči neumí sama přečíst pixely z jiného webu. Rozšíření to umí, díky stejnému snímání, jaké používá desktopová aplikace.

Stejným způsobem dělá ještě dvě další věci. Webová adresa vložená do slotu pro obrázek se může stát snímkem té stránky (**Pořídit snímek této stránky**) a rozšíření umí přečíst jedinou stránku, kterou pojmenuješ, aby Brand Studio mohlo vytáhnout značku z živé webové stránky. Každý požadavek čeká na tvé schválení v rozšíření.

Funguje v prohlížečích založených na Chromiu: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 nebo novější.

Dokud není nainstalované, **URL Screenshot** se přesto otevře, takže si můžeš snímek nastavit, a poznámka nahoře v ovládacích prvcích nástroje řekne, co chybí.

![Poznámka nástroje URL Screenshot nabízející rozšíření, zobrazená, když snímání do souboru nemá na čem běžet](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Každý ovládací prvek je funkční, i když čekáš: cílová URL, hloubka scrollu, prodleva před ustálením, ořezové okraje i přebarvení. Host potřebuje jen samotné snímání.

![Ovládací prvky URL Screenshot s cílovou URL, hloubkou scrollu, prodlevou před ustálením a ořezovými okraji, vše použitelné ještě před existencí rozšíření](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalace

### Z Chrome Web Store

*Už brzy.* Jakmile bude zveřejněné, nainstaluješ ho jedním kliknutím a pak Lolly znovu načteš.

### Načti si ho sám (pro vývojáře)

Rozšíření žije v repozitáři v `shells/chrome-extension/`. Ta složka je produkční build, který funguje jen s Lolly na `https://lolly.tools`.

1. Otevři `chrome://extensions`.
2. Zapni **Developer mode** (vpravo nahoře).
3. Klikni na **Load unpacked** a vyber složku `shells/chrome-extension/`.
4. Znovu načti Lolly - **URL Screenshot** teď v prohlížeči funguje.

Pro lokální vývojový server spusť `pnpm run pack:chrome-extension:dev` a místo toho načti `dist/chrome-extension-dev`. Tento balíček přijímá i `http://localhost:5173` a má v názvu **Development**.

## Jak to funguje

- Malý skript oznámí Lolly, že rozšíření je přítomné, takže **URL Screenshot** může ukládat snímky bez dalšího nastavování.
- Každý požadavek schvaluješ ty. Když se Lolly zeptá, rozšíření otevře vlastní okno **Approve page request**, které ukáže žádající web, zda chce snímek, nebo obsah stránky, a adresu stránky. Nic se nečte, dokud nestiskneš **Approve once**. **Cancel** nebo zavření okna požadavek ukončí.
- Když poprvé schválíš požadavek pro nějaký web, Chrome se navíc zeptá, zda smí rozšíření k tomu webu přistupovat. Jakmile to povolíš, Chrome si přístup pamatuje, ale každý další požadavek stále potřebuje své vlastní **Approve once**.
- Schválení platí pro jeden požadavek a vyprší po 30 sekundách. Jen jeden požadavek může čekat nebo běžet najednou a schválený požadavek se zastaví po 55 sekundách. Pokud se stránka Lolly zavře nebo změní, nebo cílová stránka přejde na jiný web, požadavek se zruší.
- Po schválení rozšíření otevře cílovou stránku na pozadí v samostatné záložce, zachytí ji přes DevTools Protocol (stejný `Page.captureScreenshot`, jaký používá desktopová aplikace), pak záložku zavře a obrázek vrátí do záložky Lolly, která o něj požádala.
- Běží celé v tvém prohlížeči, na tvé síti - takže funguje i snímání `localhost` nebo interního webu. Stránka se načítá s tvou relací v prohlížeči, takže stránka, do které jsi přihlášený, může ve výsledku ukázat soukromé informace. Samotný snímek se nikam neposílá; jediný síťový provoz je tvůj vlastní prohlížeč, který načítá stránku, kterou jsi chtěl vyfotit.

Během snímání se na dočasné záložce může krátce objevit hláška *"…started debugging this browser"*. To je DevTools Protocol v akci; jakmile je snímek hotový, sama zmizí.

## Čtení webu pro Brand Studio

Zdroj **Website** v Brand Studiu založí brand z webu, který už máš. V Chromiu ho čte rozšíření, v desktopové aplikaci dělá stejnou práci nativní fetch, a v obyčejném prohlížeči bez rozšíření se tato dlaždice vůbec nenabízí.

Co se stane, když ho stiskneš:

- Jedna adresa, jedna stránka. Po tvém schválení ji rozšíření otevře ve stejném typu záložky na pozadí, přečte vykreslený markup, text stylesheetů a hrstku ikon a log, pak záložku zavře. Neproklikává odkazy a neprochází web dál.
- Stylesheety hostované jinde (CDN, fontová služba) se také stahují, protože v nich žijí barvy a typografie stránky. Requesty na jinou doménu jdou bez tvých cookies, requesty na stejnou doménu je používají, přesně jako by je použila stránka sama.
- Všechno má strop - omezený počet stylesheetů, obrázků a bajtů - takže i nepřátelská nebo napůl rozbitá stránka vrátí jen částečný materiál místo toho, aby se to zaseklo.
- Bajty jdou rovnou zpátky do záložky Lolly, která o ně požádala. Rozpoznání barev, typografie a log probíhá na tvém zařízení; nic se neuploaduje.

Vložení adresy jen vyplní pole. Nic se nečte, dokud nezačneš čtení a nestiskneš **Approve once**.

## Po instalaci

Znovu načti záložku Lolly. Výzva "Get the extension" zmizí, **URL Screenshot** (v Utilities) může ukládat snímky do souboru a nástroj bude dostupný v dávkovém režimu.

## Oprávnění

Jeho `manifest.json` deklaruje čtyři oprávnění plus přístup k webům, o který žádá po jednom webu:

- `debugger` - ovládá záložku na pozadí přes DevTools Protocol. Tím se pořizuje snímek.
- `tabs` - otevře dočasnou záložku na pozadí a poté ji zase zavře a ověří, že se od tvého schválení nepřesunula ani stránka Lolly, ani cílová stránka.
- `scripting` - spustí jednostránkovou čtečku uvnitř webu, který jsi zadal, pro zdroj Website v Brand Studiu.
- `storage` - poznamená si id otevřené záložky, jen v paměti relace, aby se záložka zavřela i tehdy, když prohlížeč rozšíření uprostřed čtení pozastaví. Při dalším spuštění se maže; nic o tobě se neukládá.
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - přístup k webům, který se při instalaci neuděluje. Když stiskneš **Approve once**, rozšíření požádá Chrome o přístup k jedinému webu z daného požadavku a Chrome se tě zeptá při prvním použití každého webu.

Čte jen tu jedinou stránku, kterou schválíš, a tvá data z prohlížení nečte ani nikam nepřenáší - nic se neuploaduje.

Manifest také nastavuje `minimum_chrome_version: 111`. Aktuální verze je 0.4.0.

## Řešení problémů

- **Pořád vidíš "Get the extension"?** Znovu načti záložku Lolly - detekce probíhá při načtení stránky.
- **Na tomto webu se nic neděje?** Rozšíření funguje jen na `https://lolly.tools` a ve vývojovém balíčku také na `http://localhost:5173`. Jiný origin, například vlastní hostovaná kopie Lolly, potřebuje samostatný build rozšíření, který tento origin uvádí v `manifest.json` i v `policy.js`. Úprava samotného manifestu už nefunguje.
- **Snímání selže?** Zkontroluj, že je URL dostupná a začíná `http://` nebo `https://`. Některé stránky automatizované snímání aktivně blokují. Pokud jsi stiskl **Cancel**, zavřel okno schválení nebo čekal déle než 30 sekund, spusť snímání znovu.
