# Rozšíření prohlížeče

Rozšíření **Lolly URL Screenshot** umožňuje webové aplikaci vyfotit libovolnou webovou stránku přímo z prohlížeče. Bez něj potřebuje snímání URL desktopovou aplikaci - stránka v prohlížeči neumí sama přečíst pixely z jiného webu. Rozšíření to umí, díky stejnému snímání, jaké používá desktopová aplikace.

Stejným způsobem dělá ještě jednu věc: čte jedinou stránku, kterou pojmenuješ, aby Brand Studio mohlo vytáhnout značku z živé webové stránky. Obě jsou popsané níže.

Funguje v prohlížečích založených na Chromiu: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 nebo novější.

Dokud není nainstalované, **URL Screenshot** se přesto otevře, takže si můžeš snímek nastavit, a poznámka nahoře v ovládacích prvcích nástroje řekne, co chybí.

![Poznámka nástroje URL Screenshot nabízející rozšíření, zobrazená, když snímání do souboru nemá na čem běžet](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Každý ovládací prvek je funkční, i když čekáš: cílová URL, hloubka scrollu, prodleva před ustálením, ořezové okraje i přebarvení. Host potřebuje jen samotné snímání.

![Ovládací prvky URL Screenshot s cílovou URL, hloubkou scrollu, prodlevou před ustálením a ořezovými okraji, vše použitelné ještě před existencí rozšíření](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalace

### Z Chrome Web Store

*Už brzy.* Jakmile bude zveřejněné, nainstaluješ ho jedním kliknutím a pak Lolly znovu načteš.

### Načti si ho sám (pro vývojáře)

Rozšíření žije v repozitáři v `shells/chrome-extension/`.

1. Otevři `chrome://extensions`.
2. Zapni **Developer mode** (vpravo nahoře).
3. Klikni na **Load unpacked** a vyber složku `shells/chrome-extension/`.
4. Znovu načti Lolly - **URL Screenshot** teď v prohlížeči funguje.

## Jak to funguje

- Malý skript oznámí Lolly, že rozšíření je přítomné, takže se nástroj **URL Screenshot** zapne sám - žádné nastavování.
- Když spustíš render, rozšíření otevře cílovou stránku na pozadí v samostatné záložce, zachytí ji přes DevTools Protocol (stejný `Page.captureScreenshot`, jaký používá desktopová aplikace), pak záložku zavře a obrázek vrátí zpět.
- Běží celé v tvém prohlížeči, na tvé síti - takže funguje i snímání `localhost` nebo interního webu. Samotný snímek se nikam neposílá; jediný síťový provoz je tvůj vlastní prohlížeč, který načítá stránku, kterou jsi chtěl vyfotit.

Během snímání se na dočasné záložce může krátce objevit hláška *"…started debugging this browser"*. To je DevTools Protocol v akci; jakmile je snímek hotový, sama zmizí.

## Čtení webu pro Brand Studio

Zdroj **Website** v Brand Studiu založí brand z webu, který už máš. V Chromiu ho čte rozšíření, v desktopové aplikaci dělá stejnou práci nativní fetch, a v obyčejném prohlížeči bez rozšíření se tato dlaždice vůbec nenabízí.

Co se stane, když ho stiskneš:

- Jedna adresa, jedna stránka. Rozšíření ji otevře ve stejném typu záložky na pozadí, přečte vykreslený markup, text stylesheetů a hrstku ikon a log, pak záložku zavře. Neproklikává odkazy a neprochází web dál.
- Stylesheety a fonty hostované jinde (CDN, fontová služba) se také stahují, protože v nich žijí barvy a typografie stránky. Requesty na jinou doménu jdou bez tvých cookies, requesty na stejnou doménu je používají, přesně jako by je použila stránka sama.
- Všechno má strop - omezený počet stylesheetů, obrázků a bajtů - takže i nepřátelská nebo napůl rozbitá stránka vrátí jen částečný materiál místo toho, aby se to zaseklo.
- Bajty jdou rovnou zpátky do záložky Lolly, která o ně požádala. Rozpoznání barev, typografie a log probíhá na tvém zařízení; nic se neuploaduje.

Nic se nečte, dokud nestiskneš tlačítko. Vložení adresy jen vyplní pole.

## Po instalaci

Znovu načti záložku Lolly. Výzva "Get the extension" zmizí a **URL Screenshot** se objeví v galerii i v dávkovém režimu.

## Oprávnění

Jeho `manifest.json` deklaruje čtyři oprávnění plus přístup k hostům:

- `debugger` - ovládá záložku na pozadí přes DevTools Protocol. Tím se pořizuje snímek.
- `tabs` - otevře dočasnou záložku na pozadí a poté ji zase zavře.
- `scripting` - spustí jednostránkovou čtečku uvnitř webu, který jsi zadal, pro zdroj Website v Brand Studiu.
- `storage` - poznamená si id otevřené záložky, jen v paměti relace, aby se záložka zavřela i tehdy, když prohlížeč rozšíření uprostřed čtení pozastaví. Při dalším spuštění se maže; nic o tobě se neukládá.
- `host_permissions: ["<all_urls>"]` - přístup ke *všem* webům, protože rozšíření můžeš namířit na libovolnou URL. Chrome to při instalaci ukáže jako širokou výstrahu "read and change all your data on all websites".

Navzdory téhle výstraze rozšíření čte jen tu jedinou stránku, kterou mu zadáš ke snímání nebo importu, a tvá data z prohlížení nečte ani nikam nepřenáší - nic se neuploaduje.

Manifest také nastavuje `minimum_chrome_version: 111`. Aktuální verze je 0.2.1.

## Řešení problémů

- **Pořád vidíš "Get the extension"?** Znovu načti záložku Lolly - detekce probíhá při načtení stránky.
- **Na tomto webu se nic neděje?** Rozšíření se aktivuje jen na vlastních doménách Lolly. Pokud běžíš na vlastním buildu na jiné doméně, přidej ji do `content_scripts.matches` v `manifest.json` rozšíření.
- **Snímání selže?** Zkontroluj, že je URL dostupná a začíná `http://` nebo `https://`. Některé stránky automatizované snímání aktivně blokují.
