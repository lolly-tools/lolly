# Verifică singur

Fiecare promisiune de pe acest site poate fi verificată, fără cont. Cele mai multe verificări au nevoie doar de un browser; restul au nevoie de un terminal și o copie a sursei. Dacă o verificare de mai jos nu dă rezultatul arătat, aceasta este un bug sau o promisiune încălcată și vrem să aflăm: vezi [Dacă o verificare eșuează](#if-a-check-fails).

Începe cu cea mai rapidă: plasează un fișier pe Verify. Apoi mergi mai departe: urmărește rețeaua cât folosești un instrument, scoate cablul și continuă să lucrezi, numără cookie-urile și citește sursa.

Aceste verificări acoperă Lolly de unul singur. Dacă organizația ta rulează Lolly Work, aceasta adaugă autentificare, conținut comun, telemetrie configurată și înregistrări de audit; verifică-le față de [Suprafața serverului](/info/server-surface.html) și [secțiunea organizației din politica de confidențialitate](/info/privacy.html#organisation-services-with-lolly-work).

## Vezi-o funcționând, în zece secunde

Deschide [`/verify`](/#/verify) și plasează un fișier pe pagină. Nu există încărcare, cont sau așteptare pentru un server. Aici verifică [furtuna din Queensland generată](/info/ai-stance.html) din Poziția noastră despre AI: o imagine generată de Gemini, pe care Lolly a deschis-o, marcat-o și convertit-o. Fiecare insignă a fost calculată pe dispozitiv, din octeții proprii ai fișierului.

![Verify pe un ecran cu lățime de telefon - imaginea furtunii, un verdict verde Made with Lolly și insignele credential-intact și bytes-unchanged stivuite dedesubt](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Verdictul este o mică grămadă de insigne, fiecare un fapt independent:

- <!--i:lock--> **Made with Lolly**: credențiala este intactă *și* înregistrează un export Lolly.
- <!--i:seal--> **The credential is intact**: manifestul C2PA semnat se parsează și propria lui semnătură de afirmație se verifică.
- <!--i:hash--> **The bytes have not changed**: hash-ul fișierului se potrivește încă cu ce a fost semnat. Schimbă un pixel și această insignă se răstoarnă.
- <!--i:sparkle--> **GEN AI**: o mașină a făcut acești pixeli, iar fișierul spune asta. Lolly citește acea declarație înapoi, în loc să ascundă faptul.

Întregul istoric călătorește cu fișierul. Nouă pași supraviețuiesc aici: cinci pe care Google i-a înregistrat când a generat și a filigranat imaginea, apoi patru pe care Lolly i-a înregistrat când a deschis, marcat și convertit copia de pe această pagină. Verify îi citește direct din octeți și îi desenează ca o cronologie.

![Istoricul de schimbări pe care Verify îl citește înapoi din imaginea furtunii - cinci pași înregistrați de Google, apoi patru de Lolly, terminând în WebP-ul de pe această pagină](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Aceasta este demonstrația. Verificările de mai jos sunt garanțiile de dedesubt, iar fiecare este reproductibilă. [Content Credentials](/info/content-credentials-identity.html) explică fiecare verdict.

## În browserul tău, fără unelte necesare

::: timeline
- <!--i:globe--> **1. Urmărește rețeaua.** Deschide [lolly.tools](https://lolly.tools), deschide DevTools din browser (F12), treci la **Network** și folosește un instrument: tastează o adresă web în [QR Code](/t/qr-code), schimbă culorile, exportă un PNG. Fiecare cerere rămâne pe `lolly.tools`: shell-ul aplicației, fișierele proprii ale instrumentului și resursele din catalog. Nu există gazdă de analiză, beacon CDN, serviciu de fonturi sau endpoint de raportare a erorilor. Ce tastezi într-un instrument nu apare în **nicio cerere**, pentru că randarea este locală.
- <!--i:eyeoff--> **2. Scoate cablul.** Încarcă aplicația și deschide un instrument sau două, apoi treci offline (modul avion sau DevTools → Network → Offline) și reîncarcă. Galeria și fiecare instrument deschis de tine continuă să funcționeze, inclusiv randarea și exportul în formatele folosite. Fișierele unui instrument și codificatorul unui format sunt puse în cache prima dată când le folosești, deci folosește un instrument o dată online înainte să-l testezi offline. Aceasta este cea mai puternică verificare singulară de pe această pagină: un software care sună acasă nu supraviețuiește tăierii cablului.
- <!--i:check--> **3. Numără cookie-urile.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Lista este goală: aplicația nu setează cookie-uri. Lipește `document.cookie` în consolă și primești `""`. Înrolarea CA opțională setează un cookie `HttpOnly` de scurtă durată, `lolly_ca_state`, cu domeniul `/api/ca`, pe care `document.cookie` nu îl poate arăta. O instanță Lolly Work folosește propriile cookie-uri de autentificare; compară-le cu [Confidențialitate](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Citește-ți propria stocare.** În același panou, tot ce păstrează Lolly este în fața ta: câteva zeci de chei `localStorage` simple (temă, limbă, lățimea barei laterale, setări de sunet și vedere și o copie în cache a indexului public de instrumente) și documentele tale în IndexedDB. Fiecare valoare este un șir sau JSON lizibil, fără nimic ofuscat. Ștergerea datelor site-ului elimină aceste înregistrări locale, dar nu un backup Sync sau înregistrările ținute de o instanță Lolly Work. **Settings → Storage → Clear all my data** face același lucru din interiorul aplicației și poți urmări cum se golesc depozitele și cache-urile.
- <!--i:lock--> **5. Verifică dacă contactul de dezvăluire există.** [`/.well-known/security.txt`](/.well-known/security.txt) răspunde cu un bloc de contact [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), nu cu o pagină HTML.
:::

::: details Ce altceva poți vedea în fila Network
Unele funcții ating rețeaua doar când le folosești, iar fiecare este vizibilă în aceeași filă:

- adăugarea unui **Google Font** în Design System Setup preia acea familie de la Google, după un dialog de consimțământ care spune asta, o dată, înainte de prima preluare;
- un clic pe o presetare **ICC press-profile** preia acel profil din registrul public al ICC de la color.org;
- redarea **radioului** integrat opțional transmite de la stație;
- introducerea unei locații în **Meeting Planner** caută acel loc la serviciul de geocodare open-meteo pentru coordonate și fus orar, o dată pe oraș (răspunsurile sunt salvate pe dispozitivul tău), iar câmpul spune asta unde tastezi;
- **URL Screenshot** încarcă adresa tastată de tine, pentru că asta este treaba lui, și vezi cum se întâmplă.

Un instrument care declară o capabilitate de rețea poate prelua doar de la gazdele din lista permisă a manifestului său, iar acea verificare eșuează în siguranță. Niciun instrument livrat astăzi nu declară una, deci Content-Security-Policy aplicată de browser este ce ține lista de mai sus la gazdele ei. [Politica de confidențialitate](/info/privacy.html) păstrează tabelul canonic al tuturor acestora, inclusiv traficul unei instanțe administrate, precum reîmprospătările de politici și raportarea activată.
:::

## Dintr-un terminal

**6. Endpoint-ul de randare răspunde doar cu date publice.** Singura funcție de server care pune intrări tastate într-un URL, randările hot-link, este activă aici. [Politica de confidențialitate](/info/privacy.html) spune ce înseamnă asta pentru intrările pe care le pui într-un link.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Fiecare instalare alege (`LOLLY_DISABLE_RENDER_GET=1`): pe o instanță care îl setează, aceeași sondă returnează `404`. Acea diferență este setarea la lucru, nu o inconsecvență.

**7. Verifică serviciile pe care le activează instalarea ta.** [Suprafața serverului](/info/server-surface.html) listează serviciile opționale și leagă referințele lor detaliate. Pentru Lolly Work, include API-urile lui autentificate, conexiunea de colaborare, stocarea și furnizorii configurați. O sondă a lolly.tools public nu testează o instanță privată a unei organizații.

Dacă îți rulezi propria instanță, [Instalarea livrării](/info/deploy-delivery.html) are verificările de lansare pentru ea: integritatea modelelor, sonda de margine și lista ei de eșantioane, redările de afișare, gateway-ul privat de descărcare și catalogul semnat într-un browser.


## În sursă

Toate cele de mai sus ar putea fi totuși teatru dacă codul instalat ar diferi de codul public. Așa că verifică codul. Instalarea se construiește din [depozitul public](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Fără tracker și fără SDK de analiză, nicăieri.** Caută în codul care se livrează (motorul, fiecare shell, inclusiv extensia de browser, suprascrierile de punte Tauri și service worker-ul, funcțiile de server și pachetele de instrumente) suspecții obișnuiți:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Această scanare caută SDK-uri terțe de urmărire. Nu arată absența raportării proprii de utilizare: Lolly Work acceptă telemetrie a organizației și un jurnal de audit separat, cu propria politică și propriile teste.

**9. Fără resolver DNS terț.** Verificarea SEAL din Verify nu trimite niciodată o căutare printr-un furnizor DNS-over-HTTPS, pentru că aplicația nu are resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Serviciul de certificate nu păstrează niciun jurnal de emitere.** CA-ul de identitate nu păstrează niciun jurnal a ce a emis și niciun inventar de identități: nicio linie stdout, niciun webhook, niciun depozit de certificate. Absența poate fi căutată:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA-ul păstrează stare de lucru de scurtă durată: gălețile de limitare a ratei țin chei IP și email hash-uite pe durata ferestrei lor, iar depozitul de admitere al unei instalări administrate păstrează un identificator cu cheie și un digest al cererii cel mult zece minute. [Ingineria Content Credentials](/info/content-credentials-engineering.html#protocol) are detaliile.

## Impus de teste

Verificările de sursă de mai sus nu sunt un audit unic: sunt fixate în suita de teste, deci nu pot putrezi în tăcere. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) verifică o listă mai lungă de nume de trackere decât scanarea de mai sus și eșuează build-ul dacă:

- apare orice SDK de analiză sau urmărire oriunde în sursa livrată pe care o scanează, în codul aplicației, motorului, serverului, extensiei și pachetelor de instrumente;
- apare orice resolver DNS-over-HTTPS terț în acea sursă;
- revine jurnalul de emitere al CA, în sursă **sau** în bundle-ul de server generat;
- politica de confidențialitate pierde afirmațiile cerute legal (operator numit, temei juridic, dreptul de a depune plângere).

Rulează-le singur în clonă (Node 22.18 sau mai nou; acest fișier nu necesită `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Suita completă (`pnpm install && pnpm test`) rulează câteva mii în plus, inclusiv testele criptografice adversariale descrise în [Security & Verification](/info/security.html).

## Ce nu poți verifica din exterior

- **Jurnalele de acces ale găzduirii.** Orice server care răspunde unei cereri o poate înregistra: adresa IP, calea și ora. O sondă externă nu poate stabili cât timp sunt păstrate jurnalele. Operatorul controlează jurnalizarea, rotația și exporturile și trebuie să dezvăluie aceste alegeri. Randarea locală păstrează editările obișnuite pe dispozitivul tău; randarea opțională pe server și serviciile de spațiu de lucru comun au fluxurile de date separate descrise de politica de confidențialitate.
- **Că instalarea rulează acest cod.** Poți verifica dacă sursa este curată și dacă comportamentul instalat i se potrivește, iar verificările de mai sus fac ambele. Atestarea la nivel binar a unei instalări web nu este ceva ce oferă platforma web. Măsurile de atenuare sunt depozitul public, testele impuse și verificarea offline: o instalare alterată care sună acasă eșuează simultan la verificările 1 și 2.
- **Hooks ale instrumentelor.** Logica opțională a unui instrument integrat este revizuită, nu izolată în sandbox: rulează în pagină, dacă instrumentul nu optează pentru un Worker. Fiecare instrument de pe lolly.tools este first-party și revizuit înainte să fie livrat. [Model de amenințări](/info/threat-model.html#trust-boundaries) arată unde rulează hooks și ce le limitează.

## Dacă o verificare eșuează

O diferență între această pagină și ce observi este un raport de securitate. Trimite-l prin canalele private de la [Securitate și verificare](/info/security.html#reporting-a-vulnerability). Practicăm dezvăluirea coordonată și menționăm autorii rapoartelor.
