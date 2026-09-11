# Extensie de browser

Extensia **Lolly URL Screenshot** permite aplicației web să captureze o captură de ecran a oricărei pagini web din interiorul browserului tău. Fără ea, capturarea unui URL are nevoie de aplicația desktop - o pagină de browser nu poate citi pixeli de pe alt site de una singură. Extensia poate, folosind aceeași capturare pe care o folosește aplicația desktop.

Face un alt lucru în același mod: citește o singură pagină pe care o numești, astfel încât Brand Studio poate extrage un brand dintr-un site web live. Ambele sunt descrise mai jos.

Rulează pe browsere bazate pe Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 sau mai nou.

Până când este instalată, **URL Screenshot** se deschide totuși ca să poți compune o captură, iar o notă din partea de sus a controalelor uneltei spune ce lipsește.

![Nota uneltei URL Screenshot care oferă extensia, afișată când captura către fișier nu are gazdă pe care să ruleze](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Fiecare control este activ cât timp aștepți: URL-ul țintă, adâncimea de derulare, întârzierea de stabilizare, marginile de decupare și recolorarea. Doar captura în sine are nevoie de o gazdă.

![Controalele URL Screenshot cu un URL țintă, adâncime de derulare, întârziere de stabilizare și margini de decupare, toate utilizabile înainte ca extensia să existe](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalare

### Din Chrome Web Store

*În curând.* Odată publicată, o vei instala dintr-un click, apoi vei reîncărca Lolly.

### Încarc-o singur (dezvoltatori)

Extensia se află în depozit, la `shells/chrome-extension/`.

1. Deschide `chrome://extensions`.
2. Activează **Developer mode** (sus, în dreapta).
3. Dă click pe **Load unpacked** și alege folderul `shells/chrome-extension/`.
4. Reîncarcă Lolly - **URL Screenshot** funcționează acum în browser.

## Cum funcționează

- Un script mic îi spune lui Lolly că extensia este prezentă, astfel unealta **URL Screenshot** se activează automat - fără configurare.
- Când randezi, extensia deschide pagina țintă într-un tab de fundal, o captează prin DevTools Protocol (același `Page.captureScreenshot` pe care îl folosește aplicația desktop), apoi închide tab-ul și returnează imaginea.
- Rulează în întregime în browserul tău, pe rețeaua ta - astfel captarea `localhost`-ului sau a unui site intern funcționează. Captura în sine nu este niciodată încărcată nicăieri; singurul trafic de rețea este propriul tău browser care încarcă pagina pe care ai cerut să fie captată.

Cât timp o captură rulează, s-ar putea să vezi pe scurt un banner *"…started debugging this browser"* pe tab-ul temporar. Acesta este DevTools Protocol la lucru; dispare de la sine când captura este gata.

## Citirea unui site pentru Brand Studio

Sursa **Website** din Brand Studio pornește un brand dintr-un site pe care îl ai deja. Pe Chromium, extensia este cea care îl citește; pe aplicația desktop, o preluare nativă face aceeași treabă, iar pe un browser simplu, fără extensie, dala nu este oferită deloc.

Ce se întâmplă când apeși pe ea:

- O adresă, o pagină. Extensia o deschide în același tip de tab de fundal, citește markup-ul randat, textul foii de stil și câteva imagini de pictograme și sigle, apoi închide tab-ul. Nu urmărește legături și nu face crawling.
- Foile de stil și fonturile găzduite în altă parte (un CDN, un serviciu de fonturi) sunt de asemenea preluate, deoarece culorile și tipul paginii se află în ele. Cererile cross-origin merg fără cookie-urile tale; cele same-origin le folosesc, exact cum ar face-o pagina însăși.
- Totul este plafonat - un număr limitat de foi, imagini și octeți - astfel încât o pagină ostilă sau pe jumătate stricată returnează material parțial, în loc să blocheze procesul.
- Octeții merg direct înapoi la tab-ul Lolly care i-a cerut. Analiza în culori, tip și sigle se întâmplă pe dispozitivul tău; nimic nu este încărcat.

Nimic nu este citit până nu apeși. Lipirea unei adrese doar completează câmpul.

## După instalare

Reîncarcă tab-ul Lolly. Mesajul "Get the extension" dispare, iar **URL Screenshot** devine disponibilă în galerie și în modul Batch.

## Permisiuni

Fișierul său `manifest.json` declară patru permisiuni plus acces la gazde:

- `debugger` - conduce tab-ul de fundal prin DevTools Protocol. Acesta este ce face captura de ecran.
- `tabs` - deschide tab-ul temporar de fundal și îl închide din nou după aceea.
- `scripting` - rulează cititorul de o singură pagină în interiorul site-ului pe care l-ai numit, pentru sursa Website din Brand Studio.
- `storage` - notează id-ul unui tab pe care l-a deschis, doar în stocarea de sesiune, astfel încât tab-ul să fie totuși închis dacă browserul suspendă extensia în timpul citirii. Este ștearsă la următoarea pornire; nimic despre tine nu este stocat.
- `host_permissions: ["<all_urls>"]` - acces la *toate* site-urile, deoarece poți îndrepta extensia către orice URL alegi. Chrome afișează acest lucru la instalare ca un avertisment larg, "read and change all your data on all websites".

În ciuda acelui avertisment, ea citește doar singura pagină pe care i-o ceri să o captureze sau importe și nu citește sau transmite datele tale de navigare - nimic nu este încărcat nicăieri.

Manifestul mai setează și `minimum_chrome_version: 111`. Versiunea curentă este 0.2.1.

## Depanare

- **Tot vezi "Get the extension"?** Reîncarcă tab-ul Lolly - detectarea se întâmplă la încărcarea paginii.
- **Nu se întâmplă nimic pe acest site?** Extensia se activează doar pe originile proprii ale Lolly. Rulezi o compilare personalizată pe alt domeniu? Adaug-o la `content_scripts.matches` din `manifest.json`-ul extensiei.
- **O captură eșuează?** Verifică dacă URL-ul este accesibil și începe cu `http://` sau `https://`. Unele pagini blochează activ captarea automatizată.
