# Verifică singur

Paginile de confidențialitate și securitate ale Lolly fac afirmații: fără analitice, fără urmărire, fișierele nu părăsesc niciodată dispozitivul, un singur cookie în tot sistemul. Această pagină este diferită: nu îți cere să crezi nimic din toate acestea. Este o listă de proceduri, fiecare cu comanda sau calea de click exactă și rezultatul pe care îl vei vedea. Fiecare afirmație de aici este falsificabilă în câteva minute, majoritatea fără a instala nimic.

Dacă vreo verificare de pe această pagină nu produce rezultatul arătat, este fie un bug, fie o promisiune încălcată. [Raportează-l](#if-a-check-fails) oricum ar fi, iar noi îl vom trata cu severitatea pe care o merită o promisiune încălcată.

## Vezi-o funcționând, în zece secunde

Înainte de proceduri, recompensa. Deschide [`/verify`](/#/verify) și lasă un fișier pe ea - fără încărcare, fără cont, fără așteptare după un server. Iată-o verificând [furtuna din Queensland generată](/info/ai-stance.html) din pagina noastră despre poziția privind AI: o imagine Gemini pe care Lolly a deschis-o, redimensionat-o și exportat-o. Fiecare insignă de mai jos a fost calculată pe dispozitiv, din octeții proprii ai fișierului.

![Verify pe un ecran cu lățime de telefon - imaginea furtunii, un verdict verde Made with Lolly și insignele credential-intact și bytes-unchanged stivuite dedesubt](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Verdictul nu este o singură insignă, ci un mic teanc de insigne, fiecare un fapt independent:

- <!--i:lock--> **Made with Lolly** - acreditarea este intactă *și* consemnează un export Lolly.
- <!--i:seal--> **Acreditarea este intactă** - manifestul C2PA semnat se analizează, iar propria sa semnătură de revendicare se verifică.
- <!--i:hash--> **Octeții nu s-au schimbat** - hash-ul fișierului se potrivește încă cu ceea ce a fost semnat. Modifică un singur pixel și această insignă se răstoarnă.
- <!--i:sparkle--> **GEN AI** - o mașină a creat acești pixeli, iar fișierul o spune. Lolly citește acea afirmație înapoi, în loc să o ascundă.

Iar întreaga istorie călătorește împreună cu fișierul. Nouă pași supraviețuiesc aici - cinci înregistrați de Google pe măsură ce a generat și filigranat imaginea, apoi patru înregistrați de Lolly pe măsură ce a deschis, marcat și convertit copia de pe această pagină - citiți direct înapoi din octeți, pe dispozitivul tău, și randați ca o cronologie. Aceasta este aceeași imagine, verificată în același mod, ca cronologia C2PA din [pagina despre poziția privind AI](/info/ai-stance.html).

![Istoricul de schimbări pe care Verify îl citește înapoi din imaginea furtunii - cinci pași înregistrați de Google, apoi patru de Lolly, terminând în WebP-ul de pe această pagină](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Totuși, nimic din toate astea nu este afirmația de încredere - e demonstrația. Restul acestei pagini este afirmația de încredere: fiecare insignă de mai sus este reproductibilă, iar aici e cum reproduci garanțiile din spatele lor.

## În browserul tău, fără unelte necesare

**1. Urmărește rețeaua.** Deschide [lolly.tools](https://lolly.tools), deschide DevTools din browser (F12), treci la tabul **Network** și folosește o unealtă - scrie un URL în [QR Code](/t/qr-code), schimbă culorile, exportă un PNG. Fiecare cerere rămâne pe `lolly.tools`: shell-ul aplicației, fișierele proprii ale uneltei, resursele din catalog. Niciun host de analiză, niciun beacon CDN, niciun serviciu de fonturi, niciun endpoint de "raportare a erorilor". Ce scrii într-o unealtă nu apare **în nicio cerere** - randarea este locală.

Excepțiile oneste - fiecare opțională, inițiată de utilizator și vizibilă în același tab Network atunci când se întâmplă: adăugarea unui **Google Font** în editorul de brand preia acea familie de fonturi de la Google, după un dialog de consimțământ care îți spune exact asta, o singură dată, înainte de prima preluare; apăsarea unui **preset de profil de tipar ICC** preia acel profil din registrul public al ICC de pe color.org; redarea **radioului** opțional integrat transmite în flux de la stație; introducerea unei locații în **Meeting Planner** caută acel loc la serviciul de geocodare open-meteo pentru coordonate și fus orar, o dată pe oraș (răspunsurile sunt salvate pe dispozitivul tău), iar câmpul poartă această mențiune chiar acolo unde scrii; iar **URL Screenshot** încarcă în mod necesar URL-ul pe care l-ai scris - asta e treaba lui, și vezi cum se întâmplă. O unealtă care declară o capabilitate de rețea poate face cereri doar către gazdele permise explicit în manifestul ei, iar acest mecanism este fail-closed; nicio unealtă livrată în prezent nu declară așa ceva, deci Content-Security-Policy impusă de browser este granița care menține efectiv lista de mai sus la gazdele ei. [Politica de confidențialitate](/info/privacy.html) păstrează tabelul canonic al tuturor acestora; regula sa permanentă este că o interacțiune de rețea care nu apare în acel tabel nu are loc.

**2. Scoate ștecherul.** Încarcă aplicația și deschide o unealtă sau două, apoi treci offline - mod avion, sau DevTools → Network → Offline. Reîncarcă. Galeria și fiecare unealtă pe care ai deschis-o continuă să funcționeze, inclusiv randarea și exportul în formatele pe care le-ai folosit - fișierele unei unelte și encoderul unui format sunt puse în cache la prima folosire, așa că exersează o unealtă o dată online înainte de a o testa offline. Aceasta este cea mai puternică verificare de pe această pagină: un software care "sună acasă" nu supraviețuiește tăierii cablului.

**3. Numără cookie-urile.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Lista e goală - aplicația nu setează niciun cookie. Sau lipește `document.cookie` în consolă: obții `""`. (Singurul cookie din întregul sistem, `lolly_ca_state`, trăiește cel mult zece minute în timpul unei autentificări de identitate opționale - șters în momentul în care autentificarea se finalizează - este limitat la `/api/ca` și este `HttpOnly`: [politica de confidențialitate](/info/privacy.html) îl descrie precis.)

**4. Citește-ți propriul spațiu de stocare.** Același panou Application: tot ce păstrează Lolly poate fi inspectat chiar sub ochii tăi - vreo două duzini de chei simple `localStorage` (temă, limbă, lățimea barei laterale, setări de sunet și vizualizare, plus o copie în cache a indexului public al catalogului de unelte) și propriile tale documente în IndexedDB. Fiecare valoare este un șir citibil sau JSON - nimic nu este obfuscat, nimic nu este codificat pentru a descuraja citirea. **Profile → Clear all my data** o șterge; la fel și ștergerea datelor site-ului din browser, pentru că nu există nicio copie pe server care să supraviețuiască.

**5. Verifică dacă există contactul de dezvăluire.** [`/.well-known/security.txt`](/.well-known/security.txt) răspunde cu un bloc de contact [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), nu cu o pagină HTML.

## Dintr-un terminal

**6. Endpoint-ul de randare răspunde doar cu date publice.** Singura funcționalitate de server care pune inputuri tastate de utilizator într-un URL - randările hot-link - este activă aici, iar [politica de confidențialitate](/info/privacy.html) precizează ce înseamnă asta pentru inputurile pe care le pui într-un link:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Comutatorul este per-implementare (`LOLLY_DISABLE_RENDER_GET=1`): pe o instanță care îl setează, aceeași sondă returnează `404` - această diferență reprezintă funcționarea flag-ului, nu o inconsistență.

**7. Suprafața serverului este enumerabilă.** [Server Surface](/info/server-surface.html) listează fiecare rută existentă pe server, cu regula permanentă că un endpoint care nu apare pe acea pagină nu face parte din Lolly. Rulează `curl` pe ele; nu mai e nimic altceva de găsit.

## În sursă

Tot ce e mai sus ar putea fi totuși teatru dacă codul implementat ar diferi de codul public. Așa că verifică codul - implementarea se construiește din [repository-ul public](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Niciun tracker, niciun SDK de analiză, nicăieri.** Caută în codul livrat - motorul, fiecare shell (inclusiv extensia de browser, suprascrierile bridge-ului Tauri și service worker-ul), funcțiile de server și pachetele de unelte - suspecții obișnuiți:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Niciun resolver DNS terț.** Verificarea SEAL din Verify nu direcționează niciodată căutările printr-un furnizor DNS-over-HTTPS - aplicația web pur și simplu nu are un resolver:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Serviciul de certificate nu reține nimic.** CA-ul de identitate nu are jurnal de emitere - nici e-mailul tău, nici o marcă temporală, niciun webhook. Absența poate fi verificată prin grep:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Impus prin teste, nu prin promisiuni

Cele trei verificări de sursă de mai sus nu sunt un audit unic - sunt fixate în suita de teste, astfel încât nu pot degrada pe tăcute. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) face build-ul să eșueze dacă:

- orice SDK de analiză sau urmărire apare oriunde în sursa livrată pe care o scanează - la fel pentru codul aplicației, motorului, serverului, extensiei și pachetelor de unelte,
- orice resolver DNS-over-HTTPS terț apare în acea sursă,
- jurnalul de emitere al CA-ului reapare - în sursă **sau** în pachetul de server generat,
- politica de confidențialitate pierde declarațiile impuse legal (operatorul numit, temeiul legal, dreptul de a depune plângere).

Rulează-le tu însuți în clone (Node 22.18+; nu este nevoie de `pnpm install` pentru acest fișier):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Suita completă (`pnpm install && pnpm test`) rulează câteva mii în plus, inclusiv testele criptografice adversariale descrise în [Security & Verification](/info/security.html).

## Ce nu poți verifica din exterior - spus pe șleau

O pagină ca aceasta câștigă încredere numindu-și propriile limite:

- **Jurnalele de acces ale găzduirii.** Orice server care răspunde la o cerere poate jurnaliza cererea - IP, cale, marcă temporală. Nu poți verifica ce reține sau nu un host, și nici noi nu putem, dincolo de comportamentul documentat al furnizorului nostru. Exact de aceea arhitectura ține conținutul tău complet în afara rețelei: ce nu părăsește niciodată dispozitivul tău nu poate fi jurnalizat de nimeni.
- **Că implementarea rulează acest cod.** Poți verifica faptul că sursa este curată și că, comportamentul implementat corespunde ei (verificările de mai sus acoperă ambele capete), dar o atestare la nivel binar a unei implementări web nu este ceva ce oferă platforma web. Măsurile de atenuare sunt repository-ul public, testele impuse și verificarea offline - o implementare compromisă care "sună acasă" eșuează imediat verificările 1 și 2.
- **Hook-urile uneltelor nu sunt izolate implicit (sandboxed).** Logica opțională a unei unelte rulează revizuită, în propriul realm al paginii; fiecare unealtă de pe lolly.tools este proprie (first-party) și revizuită înainte de lansare. Izolarea prin Worker este acum disponibilă ca opțiune per unealtă - o unealtă al cărei manifest setează `isolate: true` își rulează hook-urile pe un fir separat - astfel încât ce nu poți verifica din exterior se restrânge, dar calea implicită rămâne în același realm, iar revizuirea rămâne controlul. Acest lucru este declarat, nu ascuns - vezi secțiunea [design boundaries](/info/security.html), care a afirmat mereu asta.

## Dacă o verificare eșuează

O discrepanță între această pagină și comportamentul observat este un raport de securitate, iar noi chiar preferăm să aflăm despre ea decât să nu aflăm: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), butonul **Report a vulnerability** de pe orice [repository lolly-tools](https://github.com/lolly-tools) sau contactul din [`/.well-known/security.txt`](/.well-known/security.txt). Dezvăluirea coordonată și creditarea celui care raportează sunt politica permanentă - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) are detaliile.
