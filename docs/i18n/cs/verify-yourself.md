# Ověř si to sám

Každý slib na tomto webu lze ověřit bez účtu. Většina kontrol vyžaduje jen prohlížeč, zbytek terminál a kopii zdrojového kódu. Pokud některá z níže uvedených kontrol nedá uvedený výsledek, je to chyba nebo porušený slib a chceme o tom vědět: viz [Když kontrola selže](#if-a-check-fails).

Tyto kontroly se týkají samotné Lolly. Pokud tvá organizace provozuje Lolly Work, přidává přihlašování, sdílený obsah, nakonfigurovanou telemetrii a auditní záznamy; ověř je podle [Serverových rozhraní](/info/server-surface.html) a [části zásad ochrany soukromí věnované organizacím](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Podívej se, jak to funguje, za deset sekund

Otevři [`/verify`](/#/verify) a přetáhni na stránku soubor. Nic se nenahrává, nepotřebuješ účet a nečekáš na server. Tady ověřuje [vygenerovanou bouři v Queenslandu](/info/ai-stance.html) z Našeho postoje k AI: obrázek, který vygeneroval Gemini a který Lolly otevřela, označila a převedla. Každý odznak byl určen na zařízení z bajtů samotného souboru.

![Lolly Verify na obrazovce o šířce telefonu - obrázek bouře, zelený verdikt Made with Lolly a pod ním odznaky neporušených údajů o původu a nezměněných bajtů](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Verdikt tvoří několik odznaků, každý představuje nezávislý fakt:

- <!--i:lock--> **Made with Lolly**: údaje o původu jsou neporušené *a* zaznamenávají export z Lolly.
- <!--i:seal--> **The credential is intact**: podepsaný manifest C2PA lze parsovat a podpis jeho vlastního tvrzení se úspěšně ověří.
- <!--i:hash--> **The bytes have not changed**: hash souboru stále odpovídá tomu, co bylo podepsáno. Změň jediný pixel a tento odznak se změní.
- <!--i:sparkle--> **GEN AI**: tyto pixely vytvořil stroj a soubor to uvádí. Lolly tuto deklaraci ze souboru přečte, místo aby tuto skutečnost skrývala.

Celá historie se přenáší se souborem. Tady se zachovalo devět kroků: pět zaznamenal Google při generování obrázku a přidávání vodoznaku, pak čtyři zaznamenala Lolly při otevření, označení a převodu kopie na této stránce. Lolly Verify je čte přímo z bajtů a vykreslí je jako časovou osu.

![Historie změn, kterou Lolly Verify čte z obrázku bouře - pět kroků zaznamenaných Google, pak čtyři od Lolly, končící souborem WebP na této stránce](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Níže uvedené kontroly jsou zárukami, na kterých tato ukázka stojí, a každou lze zopakovat. [Content Credentials](/info/content-credentials-identity.html) vysvětluje každý verdikt.

<!--i:eti-globe-->
## V prohlížeči, bez dalších nástrojů

::: timeline
- <!--i:globe--> **1. Sleduj síť.** Otevři [lolly.tools](https://lolly.tools), otevři DevTools v prohlížeči (F12), přepni na **Network** a použij nástroj: zadej webovou adresu do [Lolly QR Code](/t/qr-code), změň barvy, exportuj PNG. Každý požadavek míří na `lolly.tools`: prostředí aplikace, vlastní soubory nástroje a assety katalogu. Není tu žádný analytický hostitel, žádný sledovací signál CDN, žádná služba písem ani koncový bod pro hlášení chyb. To, co do nástroje napíšeš, se neobjeví **v žádném požadavku**, protože vykreslování probíhá místně.
- <!--i:eyeoff--> **2. Odpoj síť.** Načti aplikaci a otevři jeden nebo dva nástroje, pak přejdi offline (režim letadlo nebo DevTools → Network → Offline) a znovu načti stránku. Galerie a každý nástroj, který jsi otevřel, fungují dál včetně vykreslování a exportu ve formátech, které jsi použil. Soubory nástroje a kodér formátu se při prvním použití uloží do mezipaměti, takže před testováním offline nástroj jednou použij online. Toto je nejsilnější jednotlivá kontrola na této stránce: software, který musí hlásit data domů, odstřižení spojení nepřežije.
- <!--i:check--> **3. Spočítej cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Seznam je prázdný: aplikace žádné cookies nenastavuje. Vlož `document.cookie` do konzole a dostaneš `""`. Volitelná registrace u CA nastavuje krátkodobou cookie `HttpOnly`, `lolly_ca_state`, omezenou na `/api/ca`, kterou `document.cookie` nemůže zobrazit. Instance Lolly Work používá vlastní přihlašovací cookies; porovnej je se [Zásadami ochrany soukromí](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Prohlédni si vlastní úložiště.** Ve stejném panelu máš před sebou vše, co Lolly uchovává: několik desítek běžných klíčů `localStorage` (motiv, jazyk, šířka postranního panelu, nastavení zvuku a zobrazení a kopie veřejného indexu katalogu nástrojů v mezipaměti) a vlastní dokumenty v IndexedDB. Každá hodnota je čitelný řetězec nebo JSON, nic není zamlžené. Vymazání dat webu odstraní tyto místní záznamy, ale ne zálohu Sync ani záznamy uložené instancí Lolly Work. **Settings → Storage → Clear all my data** provede totéž uvnitř aplikace a můžeš sledovat, jak se úložiště a mezipaměti vyprazdňují.
- <!--i:lock--> **5. Ověř, že existuje kontakt pro hlášení zranitelností.** [`/.well-known/security.txt`](/.well-known/security.txt) vrací blok kontaktů podle [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), ne stránku HTML.
:::

::: details Co dalšího můžeš vidět na kartě Network
Některé funkce přistupují k síti jen při použití a každá je vidět na stejné kartě:

- přidání **Google Font** v Lolly Design System Setup načte právě tuto rodinu písem z Google po dialogu souhlasu, který tě na to upozorní jednou, před prvním načtením;
- kliknutí na **předvolbu tiskového profilu ICC** načte tento profil z veřejného registru ICC na color.org;
- přehrávání volitelného vestavěného **rádia** streamuje ze stanice;
- zadání místa v **Meeting Planner** vyhledá jeho souřadnice a časové pásmo v geokódovací službě open-meteo, jednou pro každé město (odpovědi se ukládají na tvém zařízení), a pole to uvádí přímo tam, kde píšeš;
- **Lolly URL Screenshot** načte adresu, kterou jsi zadal, a můžeš to sledovat.

Nástroj, který deklaruje síťovou schopnost, smí načítat jen z hostitelů povolených v jeho manifestu a při selhání této kontroly se přístup zamítne. Žádný dnes dodávaný nástroj takovou schopnost nedeklaruje, takže Content-Security-Policy vynucovaná prohlížečem omezuje výše uvedený seznam na své hostitele. [Zásady ochrany soukromí](/info/privacy.html) obsahují závaznou tabulku všech těchto přenosů, včetně provozu spravovaných instancí, jako jsou aktualizace politik a zapnuté odesílání hlášení.
:::

<!--i:eti-code-->
## Z terminálu

**6. Koncový bod vykreslování vrací jen veřejná data.** Jediná serverová funkce, která vkládá zadané vstupy do URL, vykreslování přes přímé odkazy, je zde aktivní. [Zásady ochrany soukromí](/info/privacy.html) uvádějí, co to znamená pro vstupy, které vložíš do odkazu.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Každé nasazení si volí nastavení (`LOLLY_DISABLE_RENDER_GET=1`): na instanci, která tuto proměnnou nastaví, vrátí stejná sonda `404`. Tento rozdíl znamená, že nastavení funguje, nejde o nesrovnalost.

**7. Zkontroluj služby, které tvé nasazení povoluje.** [Serverová rozhraní](/info/server-surface.html) uvádějí volitelné služby a odkazy na jejich podrobnou dokumentaci. U Lolly Work zahrň autentizovaná API, připojení pro spolupráci, úložiště a nakonfigurované poskytovatele. Sonda veřejného lolly.tools netestuje soukromou instanci organizace.

Pokud provozuješ vlastní instanci, [Nasazení doručování](/info/deploy-delivery.html) obsahuje kontroly vydání: integritu modelu, sondu edge a její seznam vzorků, verze pro zobrazení, soukromou bránu pro stahování a podepsaný katalog v prohlížeči.


<!--i:eti-search-->
## Ve zdrojovém kódu

Všechno výše by stále mohlo být jen divadlo, kdyby se nasazený kód lišil od veřejného. Proto zkontroluj kód. Nasazení se sestavuje z [veřejného repozitáře](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Žádné sledování ani analytické SDK, nikde.** V dodávaném kódu (enginu, každém prostředí aplikace včetně rozšíření prohlížeče, přepsaných implementacích mostu Tauri a service workeru, serverových funkcích a balíčcích nástrojů) vyhledej obvyklé podezřelé:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Toto prohledání hledá sledovací SDK třetích stran. Nedokazuje nepřítomnost vlastního hlášení o používání: Lolly Work podporuje telemetrii organizace a samostatný auditní protokol s vlastní politikou a testy.

**9. Žádný DNS resolver třetí strany.** Kontrola SEAL v Lolly Verify nikdy neposílá dotaz přes poskytovatele DNS-over-HTTPS, protože aplikace nemá resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Certifikační služba nevede protokol vydávání.** CA pro identitu nevede protokol toho, co vydala, ani seznam identit: žádný řádek na stdout, žádný webhook, žádné úložiště certifikátů. Nepřítomnost lze ověřit hledáním:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA ale uchovává krátkodobý pracovní stav: skupiny pro omezení četnosti požadavků ukládají hashované klíče IP adres a e-mailů po dobu svého časového okna a úložiště pro řízení přijetí požadavků ve spravovaném nasazení uchovává identifikátor odvozený pomocí klíče a otisk požadavku nejvýše deset minut. Podrobnosti obsahuje [Technická dokumentace Content Credentials](/info/content-credentials-engineering.html#protocol).

<!--i:eti-flask-->
## Vynucováno testy

Výše uvedené kontroly zdrojového kódu nejsou jednorázový audit: jsou pevně zakotvené v sadě testů, takže nemohou bez povšimnutí zastarat. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) kontroluje delší seznam názvů sledovacích nástrojů než výše uvedené prohledání a způsobí selhání sestavení, pokud:

- se jakékoli analytické nebo sledovací SDK objeví kdekoli v prohledávaném dodávaném zdrojovém kódu, napříč aplikací, enginem, serverem, rozšířením a balíčky nástrojů;
- se v tomto zdrojovém kódu objeví jakýkoli DNS-over-HTTPS resolver třetí strany;
- se vrátí protokol vydávání CA, ve zdrojovém kódu **nebo** ve vygenerovaném serverovém balíčku;
- zásady ochrany soukromí přijdou o zákonem požadovaná prohlášení (uvedený správce, právní základ, právo podat stížnost).

Spusť je sám v naklonovaném repozitáři (Node 22.18 nebo novější; tento soubor nepotřebuje `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Úplná sada (`pnpm install && pnpm test`) spouští několik tisíc dalších testů, včetně kryptografických testů simulujících útoky popsaných v [Zabezpečení a ověřování](/info/security.html).

<!--i:eti-eye-off-->
## Co nemůžeš ověřit zvenčí

- **Přístupové protokoly hostingu.** Každý server může zaznamenávat požadavky, na které odpovídá: IP adresu, cestu a čas. Vnější sonda nemůže zjistit, jak dlouho se protokoly uchovávají. Provozovatel řídí zaznamenávání, rotaci a exporty a musí tyto volby zveřejnit. Místní vykreslování udržuje běžné úpravy na tvém zařízení; volitelné serverové vykreslování a služby sdíleného pracovního prostoru mají samostatné datové toky popsané v zásadách ochrany soukromí.
- **Že nasazení používá tento kód.** Můžeš ověřit, že je zdrojový kód čistý a že chování nasazení odpovídá zdrojovému kódu, a výše uvedené kontroly dělají obojí. Webová platforma nenabízí atestaci webového nasazení na úrovni binárního kódu. Ochrannými opatřeními jsou veřejný repozitář, vynucované testy a kontrola offline: pozměněné nasazení, které odesílá data domů, selže hned v kontrolách 1 a 2.
- **Hooky nástrojů.** Volitelná logika vestavěného nástroje prochází kontrolou kódu místo izolace v sandboxu: běží na stránce, pokud nástroj nezvolí Worker. Každý nástroj na lolly.tools je vlastní a před vydáním projde kontrolou. [Model hrozeb](/info/threat-model.html#trust-boundaries) popisuje, kde hooky běží a co je omezuje.

<!--i:eti-warning-->
## Když kontrola selže

Rozdíl mezi touto stránkou a tím, co pozoruješ, je podnětem k bezpečnostnímu hlášení. Pošli ho soukromými kanály uvedenými v [Zabezpečení a ověřování](/info/security.html#reporting-a-vulnerability). Postupujeme podle zásad koordinovaného zveřejňování a uvádíme zásluhy oznamovatelů.
