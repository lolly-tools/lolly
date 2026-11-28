# Verifică singur

Fiecare promisiune de pe acest site poate fi verificată, fără cont. Cele mai multe verificări au nevoie doar de un browser; restul au nevoie de un terminal și de o copie a sursei. Dacă o verificare de mai jos nu dă rezultatul indicat, este un bug sau o promisiune încălcată și vrem să aflăm: vezi [Dacă o verificare eșuează](#if-a-check-fails).

Aceste verificări acoperă Lolly de sine stătător. Dacă organizația ta rulează Lolly Work, acesta adaugă autentificare, conținut partajat, telemetrie configurată și înregistrări de audit; verifică-le folosind [Suprafața serverului](/info/server-surface.html) și [secțiunea despre organizații din politica de confidențialitate](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Vezi cum funcționează, în zece secunde

Deschide [`/verify`](/#/verify) și trage un fișier pe pagină. Nu există încărcare pe server, cont sau așteptare după un server. Aici verifică [furtuna generată din Queensland](/info/ai-stance.html) din Poziția noastră față de AI: o imagine generată de Gemini, pe care Lolly a deschis-o, a marcat-o și a convertit-o. Fiecare insignă a fost determinată pe dispozitiv, din octeții fișierului.

![Lolly Verify pe un ecran de lățimea unui telefon - imaginea furtunii, un verdict verde Made with Lolly și insignele pentru atestare intactă și octeți neschimbați, așezate una sub alta dedesubt](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Verdictul este un mic grup de insigne, fiecare reprezentând un fapt independent:

- <!--i:lock--> **Made with Lolly**: atestarea este intactă *și* înregistrează un export Lolly.
- <!--i:seal--> **The credential is intact**: manifestul C2PA semnat poate fi parsat și semnătura propriei declarații este validă.
- <!--i:hash--> **The bytes have not changed**: hashul fișierului corespunde în continuare cu ceea ce a fost semnat. Schimbă un pixel și această insignă se schimbă.
- <!--i:sparkle--> **GEN AI**: o mașină a creat acești pixeli, iar fișierul spune asta. Lolly citește acea declarație din fișier în loc să ascundă faptul.

Întregul istoric se transferă cu fișierul. Nouă pași se păstrează aici: cinci înregistrați de Google când a generat imaginea și i-a adăugat filigranul, apoi patru înregistrați de Lolly când a deschis, a marcat și a convertit copia de pe această pagină. Lolly Verify îi citește direct din octeți și îi desenează ca o cronologie.

![Istoricul modificărilor pe care Lolly Verify îl citește din imaginea furtunii - cinci pași înregistrați de Google, apoi patru de Lolly, încheindu-se cu fișierul WebP de pe această pagină](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Verificările de mai jos sunt garanțiile din spatele acelei demonstrații și fiecare poate fi reprodusă. [Content Credentials](/info/content-credentials-identity.html) explică fiecare verdict.

<!--i:eti-globe-->
## În browserul tău, fără alte instrumente

::: timeline
- <!--i:globe--> **1. Urmărește rețeaua.** Deschide [lolly.tools](https://lolly.tools), deschide DevTools din browser (F12), treci la **Network** și folosește un instrument: scrie o adresă web în [Lolly QR Code](/t/qr-code), schimbă culorile, exportă un PNG. Fiecare cerere merge la `lolly.tools`: interfața aplicației, fișierele proprii ale instrumentului și resursele din catalog. Nu există gazdă de analiză, semnal de urmărire către un CDN, serviciu de fonturi sau punct final pentru raportarea erorilor. Ce scrii într-un instrument nu apare în **nicio cerere**, deoarece randarea este locală.
- <!--i:eyeoff--> **2. Taie conexiunea.** Încarcă aplicația și deschide unul sau două instrumente, apoi treci offline (mod avion sau DevTools → Network → Offline) și reîncarcă. Galeria și fiecare instrument pe care l-ai deschis continuă să funcționeze, inclusiv randarea și exportul în formatele pe care le-ai folosit. Fișierele unui instrument și codificatorul unui format sunt păstrate în cache la prima utilizare, deci folosește un instrument o dată online înainte de a-l testa offline. Aceasta este cea mai puternică verificare individuală de pe această pagină: un program care comunică cu serverul său nu rezistă când îi tai conexiunea.
- <!--i:check--> **3. Numără cookie-urile.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Lista este goală: aplicația nu setează cookie-uri. Lipește `document.cookie` în consolă și primești `""`. Înrolarea opțională la CA setează un cookie `HttpOnly` de scurtă durată, `lolly_ca_state`, limitat la `/api/ca`, pe care `document.cookie` nu îl poate afișa. O instanță Lolly Work folosește propriile cookie-uri de autentificare; compară-le cu [Confidențialitate](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Citește-ți propria stocare.** În același panou, tot ce păstrează Lolly este în fața ta: câteva zeci de chei `localStorage` simple (temă, limbă, lățimea barei laterale, setări de sunet și vizualizare și o copie în cache a indexului catalogului public de instrumente) și propriile documente în IndexedDB. Fiecare valoare este un șir lizibil sau JSON, fără nimic ascuns prin obfuscare. Ștergerea datelor site-ului elimină aceste înregistrări locale, dar nu și o copie de rezervă Sync sau înregistrările stocate de o instanță Lolly Work. **Settings → Storage → Clear all my data** face același lucru din aplicație, iar tu poți urmări cum se golesc depozitele și cache-urile.
- <!--i:lock--> **5. Verifică dacă există contactul pentru raportarea vulnerabilităților.** [`/.well-known/security.txt`](/.well-known/security.txt) răspunde cu un bloc de contact [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), nu cu o pagină HTML.
:::

::: details Ce mai poți vedea în fila Network
Unele funcții accesează rețeaua doar când le folosești și fiecare este vizibilă în aceeași filă:

- adăugarea unui **Google Font** în Lolly Design System Setup preia acea singură familie de la Google, după un dialog de consimțământ care spune acest lucru, o singură dată, înainte de prima preluare;
- un clic pe o **presetare de profil ICC pentru tipar** preia acel profil din registrul public ICC de la color.org;
- redarea **radioului** opțional încorporat transmite fluxul postului;
- introducerea unei locații în **Meeting Planner** caută acel loc prin serviciul de geocodificare open-meteo pentru a-i afla coordonatele și fusul orar, o dată pentru fiecare oraș (răspunsurile sunt salvate pe dispozitivul tău), iar câmpul spune asta acolo unde scrii;
- **Lolly URL Screenshot** încarcă adresa pe care ai scris-o și poți urmări cum o face.

Un instrument care declară o capabilitate de rețea poate prelua date doar de la gazdele permise explicit de manifestul său, iar dacă verificarea eșuează, accesul este blocat. Niciun instrument distribuit în prezent nu declară una, deci Content-Security-Policy impusă de browser limitează lista de mai sus la gazdele sale. [Politica de confidențialitate](/info/privacy.html) conține tabelul canonic al tuturor acestora, inclusiv traficul instanțelor administrate, precum actualizările politicilor și raportarea activată.
:::

<!--i:eti-code-->
## Dintr-un terminal

**6. Punctul final de randare răspunde doar cu date publice.** Singura funcție a serverului care pune intrările tastate într-un URL, randarea prin link direct, este activă aici. [Politica de confidențialitate](/info/privacy.html) spune ce înseamnă asta pentru intrările pe care le pui într-un link.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Fiecare implementare alege (`LOLLY_DISABLE_RENDER_GET=1`): pe o instanță care setează variabila, aceeași sondă returnează `404`. Acea diferență arată că setarea funcționează, nu o inconsecvență.

**7. Verifică serviciile pe care le activează implementarea ta.** [Suprafața serverului](/info/server-surface.html) listează serviciile opționale și trimite la referințele lor detaliate. Pentru Lolly Work, include API-urile autentificate, conexiunea de colaborare, stocarea și furnizorii configurați. O sondă a site-ului public lolly.tools nu testează o instanță privată a organizației.

Dacă rulezi propria instanță, [Implementarea serviciului de livrare](/info/deploy-delivery.html) conține verificările pentru lansare: integritatea modelului, sonda de la marginea rețelei și lista ei de eșantioane, versiunile pentru afișare, poarta privată de descărcare și catalogul semnat într-un browser.


<!--i:eti-search-->
## În sursă

Toate cele de mai sus ar putea fi încă de fațadă dacă codul implementat ar diferi de codul public. Așa că verifică sursa. Implementarea este construită din [depozitul public](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Niciun tracker și niciun SDK de analiză, nicăieri.** Caută suspecții obișnuiți în codul distribuit (motorul, fiecare interfață de rulare, inclusiv extensia de browser, suprascrierile punții Tauri și service worker-ul, funcțiile serverului și pachetele de instrumente):

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Această scanare caută SDK-uri de urmărire terțe. Nu demonstrează absența raportării utilizării către operator: Lolly Work acceptă telemetria organizației și un jurnal de audit separat, cu propria politică și propriile teste.

**9. Niciun resolver DNS terț.** Verificarea SEAL din Lolly Verify nu trimite niciodată o interogare printr-un furnizor DNS-over-HTTPS, deoarece aplicația nu are resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Serviciul de certificate nu păstrează un jurnal de emitere.** CA pentru identitate nu păstrează un jurnal al certificatelor emise și nici un inventar de identități: nicio linie stdout, niciun webhook, niciun depozit de certificate. Absența poate fi verificată prin căutare:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA păstrează totuși o stare de lucru de scurtă durată: compartimentele pentru limitarea ratei stochează chei IP și email transformate în hash pe durata ferestrei lor, iar depozitul de admitere al unei implementări administrate păstrează un identificator derivat cu cheie și hashul cererii cel mult zece minute. [Ingineria Content Credentials](/info/content-credentials-engineering.html#protocol) oferă detaliile.

<!--i:eti-flask-->
## Impuse prin teste

Verificările sursei de mai sus nu sunt un audit unic: sunt fixate în suita de teste, deci nu se pot degrada pe ascuns. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) verifică o listă de nume de trackere mai lungă decât scanarea de mai sus și face compilarea să eșueze dacă:

- orice SDK de analiză sau urmărire apare oriunde în sursa distribuită pe care o scanează, în codul aplicației, motorului, serverului, extensiei și pachetelor de instrumente;
- orice resolver DNS-over-HTTPS terț apare în acea sursă;
- jurnalul de emitere al CA reapare, în sursă **sau** în pachetul generat pentru server;
- politica de confidențialitate pierde declarațiile cerute de lege (operatorul numit, temeiul juridic, dreptul de a depune o plângere).

Rulează-le singur în clona depozitului (Node 22.18 sau mai recent; acest fișier nu necesită `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Suita completă (`pnpm install && pnpm test`) rulează alte câteva mii de teste, inclusiv testele criptografice adversariale descrise în [Securitate & verificare](/info/security.html).

<!--i:eti-eye-off-->
## Ce nu poți verifica din exterior

- **Jurnalele de acces ale găzduirii.** Orice server poate înregistra cererile la care răspunde: adresa IP, calea și momentul. O sondă externă nu poate stabili cât timp sunt păstrate jurnalele. Operatorul controlează înregistrarea, rotația și exporturile și trebuie să dezvăluie acele alegeri. Randarea locală păstrează editările obișnuite pe dispozitivul tău; randarea opțională pe server și serviciile spațiului de lucru partajat au fluxurile de date separate descrise în politica de confidențialitate.
- **Faptul că implementarea rulează acest cod.** Poți verifica dacă sursa este curată și dacă comportamentul implementării corespunde sursei, iar verificările de mai sus le fac pe amândouă. Platforma web nu oferă atestare la nivel binar a unei implementări web. Măsurile de reducere a riscului sunt depozitul public, testele obligatorii și verificarea offline: o implementare modificată neautorizat care trimite date către serverul său eșuează imediat la verificările 1 și 2.
- **Funcțiile de extensie ale instrumentelor.** Logica opțională a unui instrument încorporat este revizuită, nu izolată într-un sandbox: rulează în pagină dacă instrumentul nu optează pentru un Worker. Fiecare instrument de pe lolly.tools provine de la proiect și este revizuit înainte de distribuire. [Modelul de amenințări](/info/threat-model.html#trust-boundaries) explică unde rulează funcțiile de extensie și ce le limitează.

<!--i:eti-warning-->
## Dacă o verificare eșuează

O diferență între această pagină și ceea ce observi constituie un raport de securitate. Trimite-l prin canalele private de la [Securitate & verificare](/info/security.html#reporting-a-vulnerability). Practicăm divulgarea coordonată și recunoaștem contribuția celor care raportează.
