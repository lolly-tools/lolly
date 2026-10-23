# Extensia de browser

O pagină web nu poate citi pixelii altui site, deci aplicația web Lolly are nevoie de ajutor ca să facă o captură a unei pagini. Într-un browser bazat pe Chromium (Chrome, Edge, Brave, Arc sau Opera, de la Chrome 111), extensia gratuită **Lolly URL Screenshot** oferă acel ajutor, folosind aceeași captură pe care o folosește aplicația desktop. Cu ea instalată:

- **[URL Screenshot](/t/url-shot)** salvează pagina compusă de tine ca fișier;
- o adresă web lipită într-un slot de imagine poate deveni o captură a acelei pagini, cu **Screenshot this page**;
- sursa **Website** din [Design System Setup](/info/brand-studio.html) poate citi o pagină ca să pornească un sistem de design.

Aprobi fiecare cerere, iar aplicația desktop face aceleași sarcini fără extensie.

## Înainte să instalezi

Până când extensia este instalată, **URL Screenshot** se deschide totuși, deci poți compune o captură. O notă în partea de sus a controalelor instrumentului spune ce lipsește.

![Nota uneltei URL Screenshot care oferă extensia, afișată când captura către fișier nu are gazdă pe care să ruleze](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Fiecare control funcționează cât aștepți: URL-ul țintă, adâncimea de derulare, întârzierea de stabilizare, marginile de decupare și recolorarea. Doar captura în sine are nevoie de extensie.

![Controalele URL Screenshot cu un URL țintă, adâncime de derulare, întârziere de stabilizare și margini de decupare, toate utilizabile înainte ca extensia să existe](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalare

**Din Chrome Web Store:** în curând. Odată ce extensia este publicată, o instalezi dintr-un clic.

**Încarc-o tu însuți (dezvoltatori).** Extensia se află în depozit la `shells/chrome-extension/`. Acel dosar este build-ul de producție, care funcționează cu Lolly doar la `https://lolly.tools`.

1. Deschide `chrome://extensions`.
2. Activează **Developer mode** (dreapta sus).
3. Fă clic pe **Load unpacked** și alege dosarul `shells/chrome-extension/`.
4. Reîncarcă fila Lolly. Detectarea are loc când se încarcă pagina, deci solicitarea „Get the extension” dispare. **URL Screenshot** (în Utilities) poate apoi salva capturi într-un fișier și devine disponibil în modul Batch.

Pentru un server local de dezvoltare, rulează `pnpm run pack:chrome-extension:dev` și încarcă `dist/chrome-extension-dev` în loc. Acel pachet acceptă și `http://localhost:5173` și are **Development** în nume.

## Ce se întâmplă când Lolly cere

![Fila Lolly cere o pagină, iar tu apeși Approve once în fereastra de aprobare a extensiei. Se deschide o filă în fundal, citește pagina și se închide. Apoi fila Lolly primește rezultatul.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly cere.** Un mic script îi spune lui Lolly că extensia este prezentă, deci o captură sau o citire de pagină poate începe fără configurare suplimentară.
2. **Tu aprobi.** Extensia deschide propria fereastră **Approve page request**. Arată site-ul solicitant, dacă vrea o captură sau conținutul paginii și adresa paginii. Nimic nu este citit până nu apeși **Approve once**. **Cancel** sau închiderea ferestrei încheie cererea.
3. **Chrome întreabă o dată pe site.** Prima dată când aprobi o cerere pentru un site, Chrome întreabă și dacă extensia poate accesa acel site. Chrome păstrează acel acces odată ce îl permiți, dar fiecare cerere ulterioară are totuși nevoie de propriul **Approve once**.
4. **Pagina este citită într-o filă în fundal.** Extensia deschide pagina țintă într-o filă în fundal, o captează prin DevTools Protocol (același `Page.captureScreenshot` pe care îl folosește aplicația desktop), închide fila și predă rezultatul filei Lolly care a cerut.

O aprobare acoperă o cerere și expiră după 30 de secunde. O singură cerere poate aștepta sau rula la un moment dat, iar o cerere aprobată se oprește după 55 de secunde. Dacă pagina Lolly se închide sau se schimbă sau pagina țintă trece pe alt site, cererea este anulată.

Captura rulează în browserul tău, în rețeaua ta, deci `localhost` și site-urile interne funcționează. Pagina se încarcă cu sesiunea ta de browser, deci o pagină în care ești autentificat poate arăta informații private în rezultat. Captura nu este încărcată: singurul trafic de rețea este browserul tău care încarcă pagina cerută.

Cât rulează o captură, poți vedea scurt un banner *„…started debugging this browser”* pe fila temporară. Acela este DevTools Protocol la lucru, iar bannerul dispare când captura e gata.

## Citirea unui site pentru Design System Setup

Sursa **Website** din Design System Setup pornește un sistem de design de la un site pe care îl ai deja. Într-un browser Chromium, extensia citește pagina. În aplicația desktop, aplicația preia singură pagina. Într-un browser fără extensie, tila Website nu este oferită.

- **O adresă, o pagină.** După ce aprobi, extensia deschide pagina în același fel de filă în fundal, citește markup-ul randat, textul foii de stil și un număr mic de imagini de pictogramă și logo, apoi închide fila. Nu urmează linkuri și nu face crawl.
- **Foile de stil găzduite în altă parte** (un CDN sau un serviciu de fonturi) sunt preluate și ele, pentru că culorile și tipografia paginii trăiesc în ele. Cererile între origini merg fără cookie-urile tale; cererile din aceeași origine le folosesc, cum ar face pagina însăși.
- **Totul este plafonat**, cu o limită de foi de stil, imagini și octeți, deci o pagină ostilă sau pe jumătate stricată returnează material parțial în loc să blocheze.
- **Parsarea are loc pe dispozitivul tău.** Octeții se întorc direct la fila Lolly care a cerut, care îi transformă în culori, tipografie și logouri.

Lipirea unei adrese doar completează câmpul. Nimic nu este citit până nu pornești citirea și apeși **Approve once**.

## Permisiuni

`manifest.json` al extensiei declară patru permisiuni, plus accesul la site pe care îl cere pe rând pentru un singur site. Setează `minimum_chrome_version: 111`, iar versiunea curentă este 0.4.0.

| Permisiune | Pentru ce este | Când este acordată |
|---|---|---|
| `debugger` | Conduce fila în fundal prin DevTools Protocol, care face captura. | La instalare |
| `tabs` | Deschide fila temporară în fundal și o închide după aceea și verifică dacă nici pagina Lolly, nici pagina țintă nu s-au mutat de când ai aprobat. | La instalare |
| `scripting` | Rulează cititorul de o pagină în interiorul site-ului numit de tine, pentru sursa Website. | La instalare |
| `storage` | Notează id-ul unei file deschise, doar în session storage, ca fila să se închidă totuși dacă browserul suspendă extensia în timpul citirii. Șters la următoarea pornire; nimic despre tine nu este stocat. | La instalare |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Acces la site, neacordat la instalare. Când apeși **Approve once**, extensia cere Chrome acces la singurul site din acea cerere. | Prima dată când aprobi o cerere pentru acel site, după ce Chrome te întreabă |

Extensia citește doar singura pagină pe care o aprobi. Nu citește și nu trimite datele tale de navigare și nimic nu este încărcat.

## Depanare

- **Vezi în continuare „Get the extension”?** Reîncarcă fila Lolly.
- **Nu se întâmplă nimic pe acest site?** Extensia funcționează doar pe `https://lolly.tools`, plus `http://localhost:5173` în pachetul de dezvoltare. O altă origine, precum o copie Lolly găzduită propriu, are nevoie de propriul build al extensiei care listează acea origine atât în `manifest.json`, cât și în `policy.js`. Editarea doar a manifestului nu funcționează.
- **O captură eșuează?** Verifică dacă URL-ul este accesibil și începe cu `http://` sau `https://`. Unele pagini blochează captura automată. Dacă ai apăsat **Cancel**, ai închis fereastra de aprobare sau ai așteptat mai mult de 30 de secunde, pornește din nou captura.
