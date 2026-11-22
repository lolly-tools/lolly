# Extensia de browser

O pagină web nu poate citi pixelii altui site. Într-un browser bazat pe Chromium (Chrome, Edge, Brave, Arc sau Opera, începând cu Chrome 111), extensia gratuită **Lolly URL Screenshot** permite aplicației web Lolly să captureze o pagină cu același mecanism de captură folosit de aplicația desktop. Cu extensia instalată:

- **[Lolly URL Screenshot](/t/url-shot)** salvează pagina pe care ai compus-o ca fișier;
- o adresă web lipită într-un câmp de imagine poate deveni o captură a acelei pagini, cu **Screenshot this page**;
- sursa **Website** din [Lolly Design System Setup](/info/brand-studio.html) poate citi o pagină pentru a iniția un sistem de design.

Aprobi fiecare cerere, iar aplicația desktop face aceleași lucruri fără extensie.

<!--i:eti-checklist-->
## Înainte de instalare

Fără extensie, **Lolly URL Screenshot** se deschide în continuare și poți compune o captură. O notă deasupra controalelor instrumentului spune ce lipsește.

![Nota instrumentului URL Screenshot care propune extensia, afișată când captura într-un fișier nu are o gazdă pe care să ruleze](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Fiecare control funcționează fără extensie: URL-ul țintă, adâncimea derulării, întârzierea pentru stabilizare, marginile de decupare și recolorarea. Doar captura are nevoie de extensie.

![Controalele Lolly URL Screenshot cu un URL țintă, adâncimea derulării, întârzierea pentru stabilizare și marginile de decupare, toate utilizabile înainte de instalarea extensiei](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Instalare

**Din Chrome Web Store:** în curând. Odată publicată, extensia se instalează dintr-un clic.

**Încarc-o manual (dezvoltatori).** Sursa extensiei se află în depozit la `shells/chrome-extension/`. Pasul de împachetare construiește pachetul de producție din acel dosar. Acel pachet funcționează doar cu Lolly la `https://lolly.tools`.

1. Rulează `pnpm run pack:chrome-extension`. Acesta construiește pachetul în `dist/chrome-extension/`.
2. Deschide `chrome://extensions`.
3. Activează **Developer mode** (dreapta sus).
4. Fă clic pe **Load unpacked** și alege dosarul `dist/chrome-extension/`.
5. Reîncarcă fila Lolly. Lolly detectează extensia la încărcarea paginii, iar mesajul „Get the extension” dispare. **Lolly URL Screenshot** (în Utilities) poate apoi salva capturi într-un fișier și funcționează în modul Lolly Batch.

::: details Pentru un server local de dezvoltare sau dosarul sursă
Pentru un server local de dezvoltare, rulează `pnpm run pack:chrome-extension:dev` și încarcă în schimb `dist/chrome-extension-dev`. Acel pachet acceptă și `http://localhost:5173` și are **Development** în nume.

Încărcarea directă a dosarului `shells/chrome-extension/` funcționează și ea pentru capturi PNG. Acel dosar nu include parcurgerea paginii, pe care o integrează pasul de împachetare. Un SVG din acel dosar conține o captură de ecran, nu forme.
:::

<!--i:eti-user-check-->
## Ce se întâmplă când Lolly cere acces

![Fila Lolly cere o pagină și apeși Approve once în fereastra de aprobare a extensiei. Se deschide o filă în fundal, citește pagina și se închide. Apoi fila Lolly primește rezultatul.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly cere acces.** Un mic script îi spune lui Lolly că extensia este prezentă, astfel încât o captură sau citirea unei pagini poate începe fără configurare suplimentară.
2. **Tu aprobi.** Extensia își deschide propria fereastră **Approve page request**. Aceasta arată site-ul solicitant, dacă dorește o captură sau conținutul paginii și adresa paginii. Nu se citește nimic până nu apeși **Approve once**. **Cancel** sau închiderea ferestrei oprește cererea.
3. **Chrome întreabă o dată pentru fiecare site.** Prima dată când aprobi o cerere pentru un site, Chrome întreabă și dacă extensia poate accesa acel site. Chrome păstrează acel acces după ce îl permiți, dar fiecare cerere ulterioară are în continuare nevoie de propriul **Approve once**.
4. **Pagina este citită într-o filă din fundal.** Extensia deschide pagina țintă într-o filă din fundal, o capturează prin DevTools Protocol (același `Page.captureScreenshot` folosit de aplicația desktop), închide fila și trimite rezultatul înapoi filei Lolly care l-a cerut.

::: details Cum funcționează o captură SVG
Pentru un **SVG**, extensia parcurge pagina în loc să facă o imagine a ecranului. Un script inclus în extensie citește layoutul paginii în fila din fundal și transformă pagina în forme și text convertit în contururi. Fișierul rămâne clar la orice dimensiune și fiecare parte rămâne editabilă. Imaginile de pe pagină rămân imagini. Tot ce desenează pagina cu un canvas, un videoclip sau un efect pe care SVG nu îl poate exprima este copiat dintr-o captură de ecran din același moment. Lolly verifică rezultatul față de acea captură. Când cele două diferă prea mult, SVG-ul conține în schimb captura de ecran.

Pentru a converti textul în contururi în fontul propriu al paginii, extensia îi transmite lui Lolly fișierele de font încărcate de pagină. Chrome nu păstrează octeții unui font acolo unde o extensie îi poate citi, deci extensia cere din nou paginii fiecare font. Browserul tău răspunde de obicei din cache, iar politica de securitate a paginii se aplică în continuare acelei cereri.
:::

O aprobare acoperă o cerere și expiră după 30 de secunde. O singură cerere poate aștepta sau rula la un moment dat, iar o cerere aprobată se oprește după 55 de secunde. Dacă pagina Lolly se închide sau se schimbă ori pagina țintă trece pe alt site, cererea este anulată.

::: warning Capturile folosesc sesiunea ta de browser
Pagina se încarcă folosind sesiunea ta de browser, deci o pagină pe care ești autentificat poate afișa informații private în rezultat.
:::

Captura rulează în browserul tău, în rețeaua ta, deci `localhost` și site-urile interne funcționează. Captura nu este încărcată pe un server. Singurul trafic de rețea este încărcarea de către browser a paginii cerute și, pentru un SVG, a fișierelor de font ale acelei pagini a doua oară.

În timpul unei capturi, este posibil să vezi pentru scurt timp un banner *„…a început depanarea acestui browser”* în fila temporară. Bannerul vine de la DevTools Protocol și dispare când captura este gata.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Citirea unui site pentru Lolly Design System Setup

Sursa **Website** din Lolly Design System Setup inițiază un sistem de design pornind de la un site pe care îl ai deja. Într-un browser Chromium, extensia citește pagina. În aplicația desktop, aplicația preia singură pagina. Într-un browser fără extensie, cardul Website nu este oferit.

- **O adresă, o pagină.** După ce aprobi, extensia deschide pagina în același tip de filă din fundal, citește marcajul randat, textul foilor de stil și câteva imagini de pictograme și logouri, apoi închide fila. Extensia nu urmărește linkuri și nu parcurge site-ul.
- **Foile de stil găzduite în altă parte** (un CDN sau un serviciu de fonturi) sunt și ele preluate, deoarece conțin culorile și tipografia paginii. Cererile către alte origini se trimit fără cookie-urile tale. Cererile către aceeași origine folosesc cookie-urile tale, așa cum ar face pagina.
- **Totul are limite**, cu un plafon pentru numărul de foi de stil și imagini și pentru octeți, astfel încât o pagină ostilă sau parțial defectă returnează material parțial în loc să se blocheze.
- **Parsarea are loc pe dispozitivul tău.** Octeții se întorc direct la fila Lolly care i-a cerut, care îi transformă în culori, tipografie și logouri.

Lipirea unei adrese doar completează câmpul. Nu se citește nimic până nu pornești citirea și apeși **Approve once**.

<!--i:eti-lock-->
## Permisiuni

Fișierul `manifest.json` al extensiei declară patru permisiuni, plus accesul la site-uri, pe care îl cere pentru câte un site. Setează `minimum_chrome_version: 111`, iar versiunea curentă este 0.5.0.

| Permisiune | La ce servește | Când este acordată |
|---|---|---|
| `debugger` | Controlează fila din fundal prin DevTools Protocol, care face captura de ecran și, pentru un SVG, parcurge pagina. | La instalare |
| `tabs` | Deschide fila temporară din fundal și o închide după aceea și verifică dacă nici pagina Lolly, nici pagina țintă nu și-au schimbat adresa de când ai aprobat. | La instalare |
| `scripting` | Rulează cititorul pentru o singură pagină în site-ul indicat de tine, pentru sursa Website. | La instalare |
| `storage` | Reține ID-ul unei file pe care a deschis-o, doar în stocarea sesiunii, astfel încât fila să se închidă și dacă browserul suspendă extensia în timpul citirii. Se șterge la următoarea pornire; nu se stochează nimic despre tine. | La instalare |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Acces la site-uri, neacordat la instalare. Când apeși **Approve once**, extensia îi cere lui Chrome acces la singurul site din acea cerere. | Prima dată când aprobi o cerere pentru acel site, după ce Chrome îți cere permisiunea |

Extensia citește doar pagina pe care o aprobi. Nu citește și nu trimite datele tale de navigare.

<!--i:eti-help-->
## Depanare

- **Încă vezi „Get the extension”?** Reîncarcă fila Lolly.
- **Nu se întâmplă nimic pe acest site?** Extensia funcționează doar pe `https://lolly.tools`, plus `http://localhost:5173` în pachetul de dezvoltare. O altă origine, precum o copie Lolly găzduită pe infrastructura proprie, are nevoie de propria compilare a extensiei, care să listeze acea origine atât în `manifest.json`, cât și în `policy.js`. Editarea doar a manifestului nu funcționează.
- **O captură eșuează?** Verifică dacă URL-ul este accesibil și începe cu `http://` sau `https://`. Unele pagini blochează captura automată. Dacă ai apăsat **Cancel**, ai închis fereastra de aprobare sau ai așteptat mai mult de 30 de secunde, pornește din nou captura.
