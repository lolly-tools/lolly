# Ověř si to sám

Stránky Lolly o soukromí a bezpečnosti obsahují tvrzení: žádná analytika, žádné sledování, soubory nikdy neopustí zařízení, jediný cookie v celém systému. Tahle stránka je jiná: nežádá tě, abys jim jen věřil. Je to seznam postupů, každý s přesným příkazem nebo cestou kliknutí a výstupem, který uvidíš. Každé tvrzení tady jde ověřit za pár minut, většinou bez instalace čehokoli.

Pokud kterákoli kontrola na téhle stránce nedá výsledek, jaký je uvedený, jde buď o chybu, nebo o porušený slib. [Nahlas to](#if-a-check-fails) tak jako tak, a vezmeme to s vážností, jakou si porušený slib zaslouží.

## Vidíš to fungovat, za deset sekund

Než přijdou postupy, tady je odměna. Otevři [`/verify`](/#/verify) a přetáhni na něj soubor - žádný upload, žádný účet, žádné čekání na server. Tady kontroluje [vygenerovanou bouři nad Queenslandem](/info/ai-stance.html) ze stránky o našem přístupu k AI: obrázek z Gemini, který Lolly otevřela, zmenšila a exportovala. Každý odznak níže byl spočítaný přímo na zařízení, ze samotných bajtů souboru.

![Verify na obrazovce o šířce telefonu - obrázek bouře, zelený verdikt Made with Lolly a pod ním naskládané odznaky neporušený certifikát a nezměněné bajty](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Verdikt není jeden odznak, ale malá hromádka odznaků, každý je nezávislé tvrzení:

- <!--i:lock--> **Made with Lolly** - certifikát je neporušený *a* zaznamenává export z Lolly.
- <!--i:seal--> **Certifikát je neporušený** - podepsaný manifest C2PA se dá rozparsovat a jeho vlastní podpis nároku se ověří.
- <!--i:hash--> **Bajty se nezměnily** - hash souboru pořád odpovídá tomu, co bylo podepsáno. Změň jeden pixel a tenhle odznak sklopí.
- <!--i:sparkle--> **GEN AI** - tyhle pixely vytvořil stroj a soubor to sám říká. Lolly to tvrzení přečte zpátky, místo aby ho skrývala.

A celá historie cestuje spolu se souborem. Přežilo tu devět kroků - pět zaznamenal Google při generování a vodoznačení obrázku, pak čtyři zaznamenala Lolly při otevření, označení a konverzi kopie na téhle stránce - přečtených rovnou zpátky z bajtů, na tvém zařízení, a vykreslených jako časová osa. Je to stejný obrázek, ověřený stejným způsobem, jako časová osa C2PA na [stránce o přístupu k AI](/info/ai-stance.html).

![Historie změn, kterou Verify čte zpátky z obrázku bouře - pět kroků zaznamenal Google, pak čtyři Lolly, konče WebPkem na téhle stránce](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Nic z toho ale není důkaz důvěryhodnosti - to je jen ukázka. Zbytek této stránky je onen důkaz: každý odznak výše je ověřitelný a tady je návod, jak si ověřit záruky, které za nimi stojí.

## Ve tvém prohlížeči, bez nástrojů

**1. Sleduj síť.** Otevři [lolly.tools](https://lolly.tools), otevři si DevTools svého prohlížeče (F12), přepni na záložku **Network** a použij nějaký nástroj - zadej URL do [QR Code](/t/qr-code), změň barvy, exportuj PNG. Každý požadavek zůstává na `lolly.tools`: jádro aplikace, soubory nástroje, katalogová aktiva. Žádný analytický server, žádný CDN maják, žádná služba pro fonty, žádný endpoint pro "hlášení chyb". To, co do nástroje zadáš, se neobjeví **v žádném požadavku** - vykreslování probíhá lokálně.

Poctivé výjimky - každá je opt-in, spouští ji uživatel a je vidět ve stejné záložce Network v okamžiku, kdy nastane: přidání **Google fontu** v editoru brandu stáhne danou rodinu fontů od Googlu, a to po dialogu se souhlasem, který tě na to přesně upozorní, jednou, ještě před prvním stažením; kliknutí na **předvolbu ICC tiskového profilu** stáhne daný profil z veřejného registru ICC na color.org; přehrávání volitelného vestavěného **rádia** streamuje ze stanice; zadání místa v **Meeting Planner** vyhledá dané místo přes geokódovací službu open-meteo kvůli jeho souřadnicím a časovému pásmu, jednou na město (odpovědi se ukládají do tvého zařízení), a přímo u pole, kam píšeš, je toto upozornění uvedeno; a **URL Screenshot** nutně načítá URL, kterou jsi zadal/a - to je jeho úkol a vidíš to na vlastní oči. Nástroj, který deklaruje síťovou schopnost, smí přistupovat jen k hostitelům povoleným v jeho manifestu, a tento mechanismus je fail-closed; žádný aktuálně dodávaný nástroj takovou schopnost nedeklaruje, takže hranicí, která výše uvedený seznam hostitelů skutečně vynucuje, je Content-Security-Policy vynucovaná prohlížečem. [Zásady ochrany osobních údajů](/info/privacy.html) obsahují úplnou tabulku všeho tohoto; jejich trvalé pravidlo zní, že síťové spojení, které v této tabulce není, se nekoná.

**2. Vytáhni kabel.** Načti aplikaci, otevři jeden nebo dva nástroje a pak přejdi do offline režimu - letadlový režim, nebo DevTools → Network → Offline. Načti stránku znovu. Galerie i každý nástroj, který jsi otevřel/a, dál funguje, včetně vykreslování a exportu do formátů, které jsi použil/a - soubory nástroje a kodér daného formátu se uloží do mezipaměti při prvním použití, takže si nástroj jednou vyzkoušej online, než ho otestuješ offline. Toto je nejsilnější jednotlivá kontrola na této stránce: software, který si volá domů, přerušené spojení nepřežije.

**3. Spočítej cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Seznam je prázdný - aplikace nenastavuje žádné cookies. Nebo vlož `document.cookie` do konzole: dostaneš `""`. (Jediná cookie v celém systému, `lolly_ca_state`, žije nanejvýš deset minut během volitelného přihlášení k identitě - smaže se ve chvíli, kdy se přihlášení dokončí - je omezena na `/api/ca` a je `HttpOnly`: [zásady ochrany osobních údajů](/info/privacy.html) ji popisují přesně.)

**4. Přečti si vlastní úložiště.** Stejný panel Application: vše, co Lolly ukládá, je před tebou prohlédnutelné - pár desítek obyčejných klíčů `localStorage` (motiv, jazyk, šířka postranního panelu, nastavení zvuku a zobrazení, plus uložená kopie veřejného indexu katalogu nástrojů) a tvé vlastní dokumenty v IndexedDB. Každá hodnota je čitelný řetězec nebo JSON - nic není zatemněno, nic není zakódováno, aby se znesnadnilo čtení. **Profil → Vymazat všechna má data** je smaže; totéž udělá i vymazání dat webu v prohlížeči, protože neexistuje žádná kopie na serveru, která by to přežila.

**5. Ověř, že existuje kontakt pro nahlašování.** [`/.well-known/security.txt`](/.well-known/security.txt) odpovídá kontaktním blokem podle [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), ne HTML stránkou.

## Z terminálu

**6. Vykreslovací endpoint je na lolly.tools vypnutý.** Jediná serverová funkce, která by vkládala uživatelem zadané vstupy do URL - vykreslování přes hot-link - je zde zakázaná, dokud se služba nepřesune na hosting vlastněný organizací (proč, vysvětlují [zásady ochrany osobních údajů](/info/privacy.html)):

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 404
```

Přepínač je nastaven na úrovni jednotlivého nasazení (`LOLLY_DISABLE_RENDER_GET=1`): na instanci, která tuto proměnnou ponechá nenastavenou, je vykreslování přes hot-link zapnuté, takže tam stejná zkouška vrátí obrázek - ten rozdíl je funkčnost přepínače, ne nekonzistence.

**7. Serverová plocha je vyčíslitelná.** [Server Surface](/info/server-surface.html) vypisuje každou existující serverovou trasu s trvalým pravidlem, že endpoint, který na této stránce není, není součástí Lolly. Vyzkoušej si je přes `curl`; nic dalšího tam nenajdeš.

## Ve zdrojovém kódu

Všechno výše uvedené by pořád mohlo být jen divadlo, kdyby se nasazený kód lišil od veřejného kódu. Zkontroluj si tedy kód - nasazení se sestavuje z [veřejného repozitáře](https://github.com/lolly-tools/lolly):

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Žádný sledovací nástroj, žádné analytické SDK, nikde.** Prohledej kód, který se dodává - jádro (engine), každý shell (včetně rozšíření pro prohlížeč, přepisů Tauri bridge a service workeru), serverové funkce a balíčky nástrojů - kvůli obvyklým podezřelým:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Žádný resolver DNS třetí strany.** Kontrola SEAL v nástroji Verify nikdy nesměruje dotazy přes poskytovatele DNS-over-HTTPS - webová aplikace prostě žádný resolver nemá:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Certifikační služba si nic neuchovává.** Certifikační autorita pro identitu nemá žádný záznam o vydávání - žádný tvůj e-mail, žádné časové razítko, žádný webhook. Tuto nepřítomnost lze ověřit grepem:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Vynuceno testy, ne sliby

Výše uvedené tři kontroly zdrojového kódu nejsou jednorázový audit - jsou zapíchnuté v sadě testů, takže se nemohou tiše rozpadnout. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) shodí sestavení, pokud:

- se kdekoli ve zveřejněném zdrojovém kódu, který prochází, objeví jakékoli analytické nebo sledovací SDK - stejně tak v aplikaci, jádru, na serveru, v rozšíření i v kódu balíčků nástrojů,
- se v tomto zdrojovém kódu objeví jakýkoli resolver DNS-over-HTTPS třetí strany,
- se vrátí záznam o vydávání certifikační autority - ve zdrojovém kódu **nebo** ve vygenerovaném serverovém balíčku,
- zásady ochrany osobních údajů ztratí kterékoli ze svých zákonem vyžadovaných tvrzení (jmenovaný správce, právní základ, právo si stěžovat).

Spusť si je sám/sama v klonu (Node 22.18+; pro tento soubor není potřeba `npm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Celá sada testů (`npm install && npm test`) spouští ještě několik tisíc dalších, včetně adversariálních kryptografických testů popsaných v [Bezpečnost a ověřování](/info/security.html).

## Co zvenčí ověřit nejde - řečeno na rovinu

Stránka jako tato si důvěru zaslouží tím, že pojmenuje vlastní meze:

- **Přístupové protokoly hostingu.** Každý server, který odpovídá na požadavek, může požadavek zaznamenat - IP adresu, cestu, časové razítko. Nemůžeš ověřit, co host uchovává a co ne, a my sami to nemůžeme ověřit nad rámec zdokumentovaného chování našeho poskytovatele. Přesně proto architektura drží tvůj obsah zcela mimo dráty: co nikdy neopustí tvé zařízení, nemůže nikdo zaznamenat.
- **Že nasazení běží na tomto kódu.** Můžeš ověřit, že zdrojový kód je čistý a že nasazené chování mu odpovídá (výše uvedené kontroly pokrývají oba konce), ale atestace na úrovni binárního kódu u webového nasazení není něco, co by webová platforma nabízela. Zmírněním rizika je veřejný repozitář, vynucené testy a offline kontrola - upravené nasazení, které si volá domů, okamžitě selže na kontrole 1 a 2.
- **Háčky nástrojů (tool hooks) nejsou standardně sandboxované.** Volitelná logika nástroje běží po revizi, ve vlastním realmu stránky; každý nástroj na lolly.tools je first-party a před vydáním prochází revizí. Izolace ve workeru se nyní nabízí jako volba pro jednotlivý nástroj - nástroj, jehož manifest nastaví `isolate: true`, spouští své háčky mimo hlavní vlákno - takže to, co zvenčí ověřit nejde, se zužuje, ale výchozí cesta stále běží ve stejném realmu a kontrolou zůstává revize. To je řečeno otevřeně, ne zamlčeno - viz oddíl [hranice návrhu](/info/security.html), který to tvrdí odjakživa.

## Když kontrola selže

Rozpor mezi touto stránkou a pozorovaným chováním je bezpečnostní hlášení a opravdu raději chceme, abys nám ho poslal/a, než abys mlčel/a: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), tlačítko **Report a vulnerability** na kterémkoli [repozitáři lolly-tools](https://github.com/lolly-tools) nebo kontakt v [`/.well-known/security.txt`](/.well-known/security.txt). Koordinované zveřejnění a uznání nálezci jsou trvalá politika - podrobnosti má [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md).
