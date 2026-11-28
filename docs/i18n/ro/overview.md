# Arhitectura Lolly

![Pictograma Lolly - o acadea mare verde și albă](/info/icon.svg)

Această pagină se adresează celor care modifică codul Lolly: cum se îmbină motorul, shell-urile și pachetele de instrumente, unde se află fiecare în depozit și angajamentele care limitează fiecare schimbare. Pentru a afla ce face Lolly și cine folosește Lolly, citește mai întâi [Cum funcționează Lolly](/info/how-lolly-works.html).

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) descrie motorul modul cu modul și este generat din cod. [Modelul de amenințări & limitele de încredere](/info/threat-model.html) prezintă aceeași arhitectură prin prisma limitelor de încredere și precizează ce consideră motorul ca fiind de neîncredere.

<!--i:eti-layers-->
## Imaginea de ansamblu

Instrumentele sunt date, la nivelul de sus. Motorul din mijloc nu depinde de nicio platformă. Shell-urile de la bază implementează un singur contract, iar cataloagele furnizează conținutul.

![Instrumentele furnizează un manifest, un șablon și hook-uri motorului comun. Shell-urile web, Tauri și de terminal implementează puntea de capabilități HostV1 și citesc instrumentele și resursele din cataloage.](/info/diagrams/concepts/platform-layers.svg)

Tot ce poți descrie prin date pure și Handlebars aparține **motorului**. Tot ce accesează DOM-ul, sistemul de fișiere, rețeaua sau orice API al browserului sau al sistemului de operare aparține **gazdei**, partea punții aflată în shell. Motorul este open source. Nimic specific unui anumit brand nu intră în motor.

<!--i:eti-folder-shared-->
## Structura depozitului

Lolly este un singur depozit. Fiecare director de mai jos este un director obișnuit, cu excepția `brands/suse`: un submodul git **privat** cu pachetul de instrumente și catalogul SUSE, pe care o clonă publică nu îl descarcă. Un profil de conținut (`profiles.json`) stabilește ce pachete citește o compilare. Fiecare proces își determină propriul profil și nu există un comutator global. [Ghidul de compilare](/info/build-guide.html) conține comanda de clonare și explică cum să faci commit unei modificări în pachetul privat.

| Director | Ce conține |
|---|---|
| `engine/` | Nucleul independent de platformă: încărcător, mediu de execuție, intrări, șabloane, mod URL, unități și modulele de format |
| `shells/` | Aplicația web, aplicațiile Tauri pentru desktop și mobil, CLI, TUI și extensia de browser |
| `packages/` | SDK-ul pentru autorii de instrumente (`@lolly-tools/core`), componentele comune ale shell-ului Node și motorul de randare a documentației, printre altele |
| `community/` | Instrumentele independente de brand și pachetele emoji comune |
| `brands/` | Pachete de brand: `lolly-demo` (Lolly Demo, sistemul de design folosit de lolly.tools), `lolly-start` (punctul de pornire gol) și pachetul privat `suse` |
| `services/` | Serviciile opționale MCP, de certificate și Penpot și codul de server comun acestora |
| `schemas/` | JSON Schema pentru manifestele instrumentelor, intrările de resurse și referințele la resurse |
| `scripts/`, `tests/`, `docs/`, `api/` | Scripturi de compilare și de catalog, suita de teste a motorului, această documentație și pachetele serverless generate |

::: details Primele fișiere ale motorului și shell-ului pe care le întâlnești
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

::: note Nu există un director `tools/` sau `catalog/` la rădăcina depozitului
`packages/node-shell/src/content-roots.ts` răspunde la întrebările „unde se află instrumentul `<id>`” și „unde este catalogul” pe baza `profiles.json`. O pereche reală `tools/` și `catalog/` este scrisă doar în rezultatul unei compilări, precum `dist/`, conținutul unui RPM sau o imagine de container, deoarece un browser accesează acele două căi prin HTTP.
:::

<!--i:eti-monitor-->
## Unde rulează Lolly

Fiecare interfață folosește același motor și aceleași fișiere de instrumente.

- **Aplicația web.** O aplicație web progresivă. Funcționează offline după ce service worker-ul ei a stocat în cache instrumentele și resursele. Nu are nevoie de cont, iar starea este păstrată în IndexedDB pe fiecare dispozitiv. Un singur layout adaptiv deservește desktopul și telefonul. Pe telefon, controalele devin un panou, iar controalele de export se deschid dintr-o pastilă plutitoare.
- **Aplicațiile pentru desktop și mobil.** Pachete Tauri ale aceleiași aplicații web, cu dialoguri native pentru fișiere, stare păstrată în sistemul de fișiere și utilizare completă offline.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` încarcă același motor într-un DOM fără interfață grafică și scrie fișierul. Este modul URL printr-un alt mecanism de transport. Vezi [CLI](/info/cli.html).
- **TUI.** O aplicație de terminal pe ecran complet, concepută în primul rând pentru tastatură. Refolosește puntea CLI și păstrează sesiunile salvate pe disc: în folderul aplicației desktop când aceasta este instalată, altfel în `~/.lolly`. Pornește un browser fără interfață grafică, cu domeniu de utilizare limitat, doar când un format are nevoie de unul. Vezi [TUI](/info/tui.html).

![Vizualizarea împărțită pe desktop: controale generate din manifest în stânga, canvasul live în dreapta](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

La lățimea unui telefon, panoul de controale este sus, iar previzualizarea umple ecranul.

![O audiogramă pe un ecran lat de 430px: panoul de controale deasupra, grafica pătrată finalizată dedesubt și pastila plutitoare de export](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Aplicația web include și **Batch** (`#/batch`, `shells/web/src/pro/`), o grilă de tip foaie de calcul care randează multe rânduri simultan folosind unul sau mai multe instrumente. Vezi [Batch și Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** listează tot ce declară platforma că poate face.

![Batch la o instalare nouă: un rând gol care așteaptă un instrument, cu suprafața de tip foaie de calcul și butonul Render deja prezente înainte să sosească date](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Angajamente arhitecturale

Aceste decizii sunt stabilite. Orice altă decizie din baza de cod depinde de ele, așa că schimbarea uneia este un efort major.

### 1. Instrumente declarative, cu o cale de extindere imperativă

Un instrument este alcătuit dintr-un manifest (`tool.json`), un șablon (`template.html`) și, opțional, `hooks.js`. **Manifestul declară intrările**. Intrările nu sunt niciodată deduse din tokenurile Handlebars ale șablonului. Majoritatea instrumentelor au doar un manifest și un șablon, așa că le pot crea și persoane care nu sunt dezvoltatori.

![Stiva de controale a Street Map: o listă derulantă de orașe, un selector de temă, glisoare de grosime și declanșatoare de culoare, fiecare generat dintr-o linie a manifestului](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Instrumentele care calculează valori, precum codificarea QR sau construirea graficelor, adaugă hook-uri: funcții denumite ale ciclului de viață pe care mediul de execuție le apelează cu puntea de capabilități injectată. Hook-urile sunt un contract de portabilitate, nu un mediu izolat de securitate. Rulează într-un buget de timp. Instrumentele ale căror hook-uri sunt dovedite ca fiind independente de variabilele globale ale paginii au `isolate: true` și rulează într-un Worker. [Hook-urile instrumentelor](/info/tool-hooks.html) descrie ciclul de viață și bugetele. [Modelul de amenințări](/info/threat-model.html) precizează ce izolează și ce nu izolează executorul din pagină.

### 2. Instrumentele și resursele sunt date, nu cod inclus în pachet

Aplicațiile web și Tauri descarcă la pornire cataloagele de instrumente și resurse, le stochează în cache și lucrează cu ce se află în cache. Un instrument sau o resursă nouă nu necesită o nouă versiune a aplicației. Octeții resurselor sunt verificați prin sume de control SHA-256. `id` și `version` ale unei resurse determină invalidarea cache-ului.

### 3. Puntea de capabilități este singurul API pe care îl văd instrumentele

Instrumentele nu accesează niciodată DOM-ul în afara șablonului lor, nu apelează niciodată direct `fetch` și nu citesc niciodată sistemul de fișiere. Apelează metode `host.*` cu versiuni. Contractul este definit în `packages/core/src/host-v1.ts`, în SDK-ul pentru autorii de instrumente `@lolly-tools/core`. O terță parte poate dezvolta pe baza SDK-ului fără să depindă de motor. `engine/src/bridge/host-v1.ts` îi reexportă tipurile.

| API obligatoriu | Ce face |
|---|---|
| `host.profile` | Detaliile utilizatorului; precompletează intrările prin `bindToProfile` |
| `host.assets` | Interogări în catalog, rezolvarea resurselor și selectorul gazdei |
| `host.state` | Salvează și încarcă sloturile de intrare: IndexedDB pe web, sistemul de fișiere în Tauri, memoria în CLI |
| `host.clipboard` | Scrie text sau o imagine în clipboard, cu soluții alternative în funcție de platformă |
| `host.export` | Rasterizează sau serializează ținta randării și gestionează calea de transformare a fișierelor pe dispozitiv |
| `host.log` | Jurnalizare pe niveluri către gazdă |

Orice alt API este opțional și adaugă funcționalități: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` și multe altele. `requires` dintr-un manifest listează API-urile opționale pe care hook-urile sale le apelează fără verificare prealabilă. O gazdă căreia îi lipsește unul refuză să monteze instrumentul. Hook-urile detectează disponibilitatea celorlalte. Câteva, precum `recorder`, necesită și o capabilitate a dispozitivului pe care instrumentul o declară. `packages/core/src/host-v1/apis.ts` le listează pe toate, iar [API-ul gazdei](/info/host-api.html) îl documentează pe fiecare. Adăugarea unei metode înseamnă o versiune minoră. Eliminarea sau schimbarea uneia înseamnă o versiune majoră, iar v1 continuă să funcționeze când apare v2.

### 4. ID-urile resurselor sunt permanente

`lolly/logo/primary` este un contract. Odată publicat, un ID nu se schimbă niciodată și nu este refolosit niciodată. O modificare a octeților crește `version` în intrarea resursei. O înlocuire setează `deprecated: true` și, opțional, `replacedBy`. Referințele existente se rezolvă întotdeauna, așa că sesiunile salvate și linkurile partajate continuă să funcționeze ani de zile.

### 5. Modul URL este o funcționalitate de bază

Fiecare intrare poate fi exprimată ca parametru URL, așa că un link este un fișier finalizat:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Acel link singur, fără nimic altceva în el, este fișierul finalizat](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Schimbă un parametru și obții un fișier diferit. Această paletă înseamnă o culoare de pornire, o armonie și un număr de trepte:

![Nouă trepte în patru nuanțe, toate generate din singura culoare de pornire inclusă în link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI construiește aceeași stare URL din argumentele sale și rulează același flux de procesare, așa că CLI nu se poate abate de la aplicație. `engine/src/url-mode.ts` parsează și serializează starea URL. Numele rezervate (`format`, `width`, `dpi`, `c2pa`, `z` și altele) nu sunt niciodată transmise unui instrument. [Parametrii URL rezervați](/info/url-parameters.html) le listează pe toate. Intrările de resurse sunt transmise prin `id` și rezolvate prin `host.assets.get()` înainte de completarea șablonului.

### 6. Stocarea trece prin punte

Aplicația web folosește IndexedDB, Tauri sistemul de fișiere, iar CLI memoria. Instrumentele văd doar `host.state.save(slot, data)` și `host.state.load(slot)`, niciodată `localStorage`. Utilizatorii pot păstra mai multe sesiuni denumite pentru fiecare instrument, fără cont. Deoarece puntea este singurul punct de legătură, acea stare este și portabilă. `shells/web/src/data-transfer.ts` exportă starea ca un singur fișier `lolly-backup` care poate fi importat în orice altă instalare ([Transfer de date](/info/data-transfer.html)). [Sync](/info/sync.html) trimite același pachet către spațiul de stocare ales de utilizator.

### 7. Etichetele de maturitate arată ce este un instrument

Fiecare instrument declară `status: official | community | experimental`. Galeria sortează după stare. Instrumentele experimentale adaugă implicit filigrane exporturilor: mediul de execuție activează filigranul, cu excepția cazului în care apelantul transmite `watermark: false`. Instrumentele care operează pe dispozitiv sunt exceptate. Procesul propriu de catalog al unei echipe se adaugă peste aceste etichete.

### 8. Intrările au tipuri definite în manifest

O intrare declară un `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` sau `file`. Gazda randează un control pentru fiecare tip, așa că instrumentele nu scriu cod pentru controale. Orice intrare poate avea `bindToProfile`. Trei tipuri contează cel mai mult:

- **`asset`**, cu `filter` și `allowUpload`, este puntea către sistemul de resurse. `allowUpload: false` limitează un slot la resursele din bibliotecă. Fișierele încărcate de utilizator au aceeași structură `AssetRef` ca cele din bibliotecă.
- **`blocks`** este un grup de câmpuri repetitive editat într-un panou lateral, folosit de Meeting Planner, Wayfinding, Diagrams și altele. Un clic pe un bloc randat mută focusul pe rândul lui.
- **`file`** păstrează în memorie fișierul utilizatorului pentru utilitare care operează pe dispozitiv, precum Lolly Strip Hidden Data și Compress, iar **`vector`** grupează un set fix de numere într-un singur control.

### 9. Șabloanele nu conțin logică

Șabloanele folosesc Handlebars, așa că le pot scrie și persoane care nu sunt dezvoltatori. `{{x}}` escapează conținutul, iar `{{{x}}}` necesită o alegere explicită. Logica se află în `hooks.js`, unde poate fi revizuită. Multe șabloane folosesc `{{{` pentru marcajul calculat de un hook, așa că fiecare hook trebuie să escapeze ce transmite. Funcțiile ajutătoare sunt `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` și `media`, plus `icsStamp`, `rfcText`, `csvCell` și `arrow` pentru șabloanele asociate `.ics`, `.vcf` și `.csv`. [Șabloane și randare](/info/tool-rendering.html) le descrie.

### 10. Instrumentele compun alte instrumente

Un instrument poate încorpora randarea altui instrument fără importuri între instrumente. Motorul rezolvă compoziția. Un manifest poate declara `composes: [{ id, tool, inputs }]` și poate plasa elementul copil cu `{{asset <id>}}`. Un URL de încorporare portabil (`https://lolly.tools/tool/<id>.svg?…`) randează elementul copil local; Lolly Design plasează astfel un cod QR sau un grafic live. Un element copil SVG rămâne vectorial într-un părinte SVG sau PDF. Elementele copil sunt intermediare și nu primesc niciodată filigran sau ștampilă. Un shell care nu poate randa un element copil lasă slotul gol, iar părintele este randat în continuare. [Compoziție și suprapuneri de brand](/info/tool-composition.html) oferă detaliile.

<!--i:eti-scissors-->
## Ce am ales să nu facem

- **Fără JavaScript arbitrar în șabloane.** Logica se află în `hooks.js`.
- **Fără server obligatoriu de resurse.** Utilizatorii își adaugă propriile fișiere în Assets din aplicație și transmit munca mai departe ca sesiune: un link de partajare pentru intrări și setări, un fișier `.lolly` când sunt incluse și fișierele încărcate. O sesiune partajată poate deveni un șablon în selectorul unui instrument. O organizație care dorește un catalog guvernat poate folosi catalogul, aprobările și politicile Lolly Work sau poate gestiona pachetul de brand în git și revizui modificările acolo.
- **Fără control de acces impus.** Aplicația deschisă este publică în mod implicit. Etichetele de maturitate și filigranele semnalează riscul pentru brand. Autentificarea în organizație, rolurile și politica sunt furnizate de Lolly Work când o echipă le dorește.
- **Fără bază de date centrală.** Starea utilizatorului este păstrată pe fiecare dispozitiv, iar Sync, opțional, o copiază în spațiul de stocare ales de utilizator, niciodată într-o bază de date Lolly.
- **Fără cale de cod comună între instrumente și motor.** Motorul și instrumentele comunității sunt open source. Un pachet de brand precum cel privat `brands/suse/` conține propriile instrumente și propriul catalog, în termenii proprii. Niciun instrument nu importă din `engine/`, așa că separarea rămâne clară.

<!--i:eti-refresh-->
## Ciclul de viață al unei randări

Cineva deschide `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Pornire.** Aplicația web deschide IndexedDB, construiește puntea de capabilități și sincronizează cataloagele de instrumente și resurse sau le încarcă din cache când este offline.
2. **Rutare.** Calea selectează vizualizarea instrumentului `qr-code`, cu parametrii de interogare ca valori inițiale.
3. **Încărcare.** `loadTool` descarcă `tool.json`, îl validează față de schemă și descarcă șablonul, stilurile și hook-urile.
4. **Parsarea linkului.** `parseUrlState` transformă parametrii în valori de intrare. O referință la o resursă precum `?logo=lolly/logo/primary` devine un `{ id }` nerezolvat.
5. **Pornirea mediului de execuție.** `createRuntime(tool, host, initialValues)` construiește modelul de intrări din datele profilului, valorile implicite și link, rezolvă referințele la resurse, încarcă hook-urile și apelează `onInit`.
6. **Randare.** Shell-ul se abonează la mediul de execuție, desenează controalele pe baza modelului și scrie șablonul completat în `#tool-canvas`.
7. **Interacțiune.** Tastarea apelează `runtime.setInput`, care aplică restricțiile, apelează `onInput`, completează din nou șablonul și redesenează.
8. **Export.** **Download** apelează `runtime.export(node, format)`, iar `host.export` al shell-ului produce fișierul: un raster, un vector din parcurgerea DOM-ului, un PDF, un document sau unul dintre celelalte formate din `schemas/tool.schema.json`. Unitățile fizice sunt convertite în funcție de format. Metadatele și Content Credentials sunt încorporate acolo unde formatul le poate conține. Instrumentele experimentale primesc filigranul de la gazdă, nu de la instrument. [Șabloane și randare](/info/tool-rendering.html) și [Exportă un fișier](/info/exporting.html) descriu pasul de export.

![Panoul de export pe care îl deschide ?options: perechea nume de fișier și format, dimensiunea de ieșire și controalele care scriu fișierul](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Același ciclu de viață rulează în Tauri și în CLI cu un DOM fără interfață grafică, unde rezultatul ajunge într-un fișier sau în stdout.

<!--i:eti-stamp-->
## Licențe

Codul, inclusiv `engine/`, `shells/`, `services/`, `schemas/` și generatorul de documentație, este sub licența MPL-2.0, într-un singur depozit public, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Textul documentației este sub licența CC BY-SA 4.0. Pachetele de brand au propriii termeni în `NOTICE.md` din fiecare pachet: instrumentele comunității sunt sub licența MPL-2.0, iar pachetul privat SUSE are licență proprietară SUSE. [Despre](/info/about.html) conține nota completă privind licențierea.
