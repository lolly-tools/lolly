# Arhitectura Lolly

![Pictogramă Lolly - Acadea mare, verde și albă](/info/icon.svg)

Această pagină este pentru cei care schimbă codul Lolly: cum se îmbină motorul, shell-urile și pachetele de instrumente, unde se află fiecare în depozit și angajamentele care constrâng fiecare schimbare. Dacă vrei să știi ce face Lolly și cine îl folosește, citește mai întâi [Cum funcționează Lolly](/info/how-lolly-works.html).

Două texte însoțitoare merg mai adânc. [`engine/README.md`](../engine/README.md) este harta modul cu modul a motorului, generată din cod. [Model de amenințări și limite de încredere](/info/threat-model.html) citește aceeași arhitectură ca limite de încredere și este pagina pentru orice întrebare despre ce tratează motorul ca nesigur.

## Imaginea de ansamblu

Instrumentele sunt date, sus. Motorul din mijloc nu știe nimic despre vreo platformă. Shell-urile de jos implementează un singur contract, iar cataloagele furnizează conținutul.

![Instrumentele furnizează un manifest, un șablon și hooks motorului comun. Shell-urile web, Tauri și terminal implementează puntea de capabilități HostV1 și citesc instrumente și resurse din cataloage.](/info/diagrams/concepts/platform-layers.svg)

Dacă poți descrie ceva în date pure și Handlebars, aparține **motorului**. Dacă atinge DOM-ul, sistemul de fișiere, rețeaua sau orice API de browser ori de sistem de operare, aparține **gazdei**, partea shell-ului din punte. Motorul este open source, iar nimic care știe de un anumit brand sau o anumită platformă nu intră în motor.

## Structura depozitului

Lolly este un singur depozit. Fiecare director de mai jos este un director obișnuit în el, cu excepția `brands/suse`, un submodul git **privat** care conține pachetul de instrumente și catalogul SUSE, pe care o clonă publică nu îl preia. Ce pachete citește un build este un profil de conținut (`profiles.json`), rezolvat pe proces, nu comutat global. [Ghidul de construire](/info/build-guide.html) are comanda de clonare și cum se comite o schimbare în pachetul privat.

| Director | Ce conține |
|---|---|
| `engine/` | Nucleul agnostic de platformă: loader, runtime, intrări, șabloane, modul URL, unități și modulele de format |
| `shells/` | Aplicația web, aplicațiile Tauri desktop și mobil, CLI, TUI și extensia de browser |
| `packages/` | SDK-ul pentru autorii de instrumente (`@lolly-tools/core`), piesele comune ale shell-ului Node și renderizatorul de documentație, printre altele |
| `community/` | Instrumentele agnostice de brand, plus pachetele comune de emoji |
| `brands/` | Pachete de brand: `lolly-demo` (Lolly Demo, sistemul de design pe care rulează lolly.tools), `lolly-start` (pornirea goală) și `suse` privat |
| `services/` | Serviciile opționale MCP, de certificate și Penpot, plus codul de server pe care îl împart |
| `schemas/` | JSON Schema pentru manifestele de instrumente, intrările de resurse și referințele de resurse |
| `scripts/`, `tests/`, `docs/`, `api/` | Scripturi de build și catalog, suita de teste a motorului, aceste documente și bundle-urile serverless generate |

::: details Fișierele de motor și de shell pe care le întâlnești primele
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

Nu există un director `tools/` sau `catalog/` la rădăcina depozitului. `packages/node-shell/src/content-roots.ts` răspunde la „unde se află instrumentul `<id>`” și „unde este catalogul” din `profiles.json`, când este întrebat. O pereche reală `tools/` și `catalog/` este scrisă doar într-o ieșire de build, precum `dist/`, o încărcătură RPM sau o imagine de container, pentru că un browser preia acele două căi prin HTTP.

## Unde rulează Lolly

Fiecare suprafață folosește același motor și aceleași fișiere de instrument.

- **Aplicația web.** O aplicație web progresivă care funcționează offline după ce service worker-ul ei a pus în cache instrumentele și resursele. Nu are nevoie de cont; starea trăiește în IndexedDB pe fiecare dispozitiv. Un singur layout responsiv servește desktopul și telefonul: pe telefon controalele devin o foaie, iar controalele de export se deschid dintr-o pastilă plutitoare.
- **Aplicațiile desktop și mobile.** Pachete Tauri ale aceleiași aplicații web, cu dialoguri native de fișiere, stare în sistemul de fișiere și folosire offline completă.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` încarcă același motor într-un DOM fără interfață și scrie fișierul. Este modul URL printr-un alt transport, nu o implementare separată. Vezi [CLI](/info/cli.html).
- **TUI.** O aplicație de terminal pe tot ecranul, orientată spre tastatură, care refolosește puntea CLI, păstrează sesiunile salvate pe disc (în folderul propriu al aplicației desktop când aceasta este instalată, altfel sub `~/.lolly`) și pornește un browser fără interfață cu domeniu restrâns doar când un format are nevoie de unul. Vezi [TUI](/info/tui.html).

![Vederea împărțită desktop: controalele generate din manifest în stânga, canvasul live în dreapta](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Același instrument la lățime de telefon nu are nevoie de un al doilea layout: controalele devin o foaie sus, iar previzualizarea ține ecranul.

![O audiogramă pe un ecran de 430px lățime: foaia de controale deasupra, grafica pătrată terminată dedesubt și pastila plutitoare de export](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Aplicația web livrează și **Batch** (`#/batch`, `shells/web/src/pro/`), o grilă de tip foaie de calcul care randează multe rânduri deodată pe unul sau mai multe instrumente; [Batch și Multi-edit](/info/batch.html#make-many-versions-of-one-design) acoperă Batch. **Settings → Capabilities** cartografiază tot ce declară platforma că poate face.

![Batch la o instalare nouă: un rând gol care așteaptă un instrument, cu suprafața de tip foaie de calcul și butonul Render la locul lor înainte să sosească date](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Angajamente arhitecturale

Aceste decizii sunt stabilite. Schimbarea oricăreia este o întreprindere majoră, pentru că modelează fiecare altă decizie din codebase.

### 1. Instrumente declarative, cu o portiță de scăpare imperativă

Un instrument este un manifest (`tool.json`), un șablon (`template.html`) și un `hooks.js` opțional. **Manifestul declară intrările**, niciodată șablonul: intrările nu sunt deduse din tokenurile Handlebars. Cele mai multe instrumente sunt doar manifest și șablon, ceea ce permite non-dezvoltatorilor să le creeze.

![Stiva de controale Street Map: o listă de orașe, un select de temă, glisoare de grosime și declanșatoare de culoare, fiecare desenat dintr-o linie de manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Instrumentele care calculează valori, precum codificarea QR sau modelarea diagramelor, adaugă hooks: funcții de ciclu de viață cu nume, pe care runtime-ul le apelează cu puntea de capabilități injectată. Hooks sunt un contract de portabilitate, nu un sandbox de securitate, și rulează într-un buget de timp. Instrumentele ale căror hooks sunt dovedite libere de globale ale paginii poartă `isolate: true` și rulează într-un Worker. [Hooks de instrument](/info/tool-hooks.html) are ciclul de viață și bugetele, iar [Model de amenințări](/info/threat-model.html) spune ce conține și ce nu conține executorul din pagină.

### 2. Instrumentele și activele sunt date, nu cod împachetat

Aplicațiile web și Tauri preiau cataloagele de instrumente și resurse la pornire, le pun în cache și lucrează cu ce se află acolo, deci un instrument sau o resursă nouă nu necesită o versiune a aplicației. Octeții resurselor au sumă de control SHA-256, iar `id` și `version` ale unei resurse conduc invalidarea cache-ului.

### 3. Puntea de capabilități este singura API pe care o văd instrumentele

Instrumentele nu ating niciodată DOM-ul în afara șablonului lor, nu apelează direct `fetch` și nu citesc sistemul de fișiere. Ele apelează metode `host.*` versionate. Definiția canonică a contractului este `packages/core/src/host-v1.ts`, SDK-ul pentru autorii de instrumente `@lolly-tools/core`, deci un terț poate construi pe el fără să depindă de motor; `engine/src/bridge/host-v1.ts` reexportă tipurile lui.

| API obligatorie | Ce face |
|---|---|
| `host.profile` | Detaliile utilizatorului; completează intrările prin `bindToProfile` |
| `host.assets` | Interogări de catalog, rezolvarea resurselor și selectorul gazdei |
| `host.state` | Salvează și încarcă sloturi de intrări: IndexedDB pe web, sistemul de fișiere în Tauri, memoria în CLI |
| `host.clipboard` | Scrie text sau o imagine în clipboard, cu soluții de rezervă pe platformă |
| `host.export` | Rasterizează sau serializează ținta de randare, plus calea de transformare a fișierelor pe dispozitiv |
| `host.log` | Jurnalizare pe niveluri către gazdă |

Orice altă API este opțională și aditivă: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` și multe altele. Manifestul unui instrument listează sub `requires` API-urile opționale pe care hooks le apelează fără să verifice mai întâi, iar o gazdă care nu are una refuză să monteze instrumentul; hooks detectează restul. Câteva, precum `recorder`, necesită și o capabilitate de dispozitiv declarată de instrument. `packages/core/src/host-v1/apis.ts` le listează pe toate, iar [Host API](/info/host-api.html) o documentează pe fiecare. Adăugarea unei metode este o versiune minoră; eliminarea sau schimbarea uneia este o versiune majoră, iar v1 continuă să funcționeze când apare v2.

### 4. Id-urile resurselor sunt pentru totdeauna

`lolly/logo/primary` este un contract. Odată publicat, un id nu se schimbă niciodată și nu este refolosit. O schimbare de octeți crește `version` în intrarea resursei, iar o înlocuire setează `deprecated: true` și, opțional, `replacedBy`, deci referințele existente se rezolvă mereu. Asta ține sesiunile salvate și linkurile partajate funcționale ani de zile.

### 5. Modul URL este de prim rang

Fiecare intrare poate fi exprimată ca parametru URL, deci un link este un fișier terminat:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Acel link singur, fără nimic altceva în el, este fișierul terminat](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Schimbă un parametru și ai alt fișier. Toată această paletă este o culoare sămânță, o armonie și un număr de pași:

![Nouă pași pe patru nuanțe, toate crescute din culoarea-sămânță unică transportată în link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI construiește aceeași stare URL din argumentele lui și rulează același lanț, deci CLI nu poate devia de la aplicație. `engine/src/url-mode.ts` parsează și serializează; un set de nume rezervate (`format`, `width`, `dpi`, `c2pa`, `z` și altele) nu este niciodată transmis unui instrument, iar [Parametrii URL rezervați](/info/url-parameters.html) îi listează pe toți. Intrările de resurse călătoresc după `id` și se rezolvă prin `host.assets.get()` înainte ca șablonul să se completeze.

### 6. Stocarea trece prin punte

Aplicația web folosește IndexedDB, Tauri sistemul de fișiere, iar CLI memoria. Instrumentele văd doar `host.state.save(slot, data)` și `host.state.load(slot)`, niciodată `localStorage`. Oamenii pot păstra mai multe sesiuni cu nume pe instrument, fără cont. Pentru că puntea este singura cusătură, acea stare este și portabilă: `shells/web/src/data-transfer.ts` o citește într-un singur fișier `lolly-backup` care se importă pe orice altă instalare ([Transferul de date](/info/data-transfer.html)), iar [Sync](/info/sync.html) trimite același bundle în spațiul de stocare ales de persoană.

### 7. Etichetele de maturitate spun ce este un instrument

Fiecare instrument declară `status: official | community | experimental`. Galeria sortează după status, iar instrumentele experimentale își filigranează exporturile implicit: runtime-ul pornește filigranul dacă apelantul nu trece `watermark: false`, iar instrumentele pe dispozitiv sunt scutite. Orice proces pune o echipă în jurul catalogului se așază peste aceasta.

### 8. Intrările sunt tipizate în manifest

O intrare declară un `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` sau `file`. Gazda randează un control pe tip, deci instrumentele nu scriu cod de control, iar orice intrare poate purta `bindToProfile`. Trei au cea mai mare greutate:

- **`asset`**, cu `filter` și `allowUpload`, este puntea către sistemul de resurse. `allowUpload: false` limitează un slot la resursele bibliotecii, iar încărcările utilizatorilor au aceeași formă `AssetRef` ca biblioteca.
- **`blocks`** este un grup repetitiv de câmpuri editat într-un panou lateral, folosit de Meeting Planner, Wayfinding, Diagrams și altele. Un clic pe un bloc randat dă focus rândului lui.
- **`file`** ține fișierul propriu al utilizatorului în memorie pentru utilitare pe dispozitiv precum Strip Hidden Data și Compress, iar **`vector`** grupează un set fix de numere într-un singur control.

### 9. Șabloanele sunt fără logică

Șabloanele sunt Handlebars, ales pentru ca non-dezvoltatorii să le poată scrie: `{{x}}` escapează, iar `{{{x}}}` este un opt-in explicit. Logica trăiește în `hooks.js`, unde este explicită și revizuibilă. Multe șabloane folosesc `{{{` pentru markup calculat de un hook, deci fiecare hook trebuie să escapeze ce predă. Helperii sunt `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` și `media`, plus `icsStamp`, `rfcText`, `csvCell` și `arrow` pentru șabloanele surori `.ics`, `.vcf` și `.csv`. [Șabloane și randare](/info/tool-rendering.html) le acoperă.

### 10. Uneltele compun unelte

Un instrument poate încorpora randarea altui instrument fără importuri între instrumente; motorul rezolvă compoziția. Un manifest poate declara `composes: [{ id, tool, inputs }]` și plasa copilul cu `{{asset <id>}}`, iar un URL portabil de încorporare (`https://lolly.tools/tool/<id>.svg?…`) randează copilul local, așa plasează Design un cod QR sau o diagramă live. Un copil SVG rămâne vector într-un părinte SVG sau PDF. Copiii sunt intermediari, niciodată filigranați sau ștampilați, iar un shell care nu poate randa unul lasă slotul gol în timp ce părintele randează în continuare. [Compoziție și suprapuneri de brand](/info/tool-composition.html) are detaliile.

## Ce am ales să nu facem

- **Fără JavaScript arbitrar în șabloane.** Logica trăiește în `hooks.js`.
- **Fără server de resurse obligatoriu.** Oamenii își adaugă propriile fișiere în Assets din aplicație și predau munca ca sesiune: un link de partajare pentru intrări și setări, un fișier `.lolly` când călătoresc și încărcările. O sesiune partajată poate deveni șablon în selectorul unui instrument. O organizație care vrea un catalog guvernat poate folosi catalogul, aprobările și politicile Lolly Work sau poate gestiona pachetul de brand în git și revizui acolo schimbările.
- **Fără control de acces forțat.** Aplicația deschisă este publică implicit, iar etichetele de maturitate și filigranele poartă riscul de brand. Autentificarea organizației, rolurile și politica vin de la Lolly Work când o echipă le vrea.
- **Fără bază de date centrală.** Starea utilizatorului trăiește pe fiecare dispozitiv, iar Sync opțional o copiază în spațiul de stocare ales de persoană, niciodată într-o bază de date Lolly.
- **Fără cale de cod comună între instrumente și motor.** Motorul și instrumentele comunitare sunt open source, iar un pachet de brand precum `brands/suse/` privat își poartă propriile instrumente și catalog sub propriii termeni. Niciun instrument nu importă din `engine/`, deci separarea rămâne curată.

## Ciclul de viață al unei randări

Cineva deschide `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Pornire.** Aplicația web deschide IndexedDB, construiește puntea de capabilități și sincronizează cataloagele de instrumente și resurse sau le încarcă din cache când este offline.
2. **Rută.** Calea alege vederea instrumentului pentru `qr-code`, cu interogarea ca valori inițiale.
3. **Încărcare.** `loadTool` preia `tool.json`, îl validează față de schemă și preia șablonul, stilurile și hooks.
4. **Parsarea linkului.** `parseUrlState` transformă parametrii în valori de intrare. O referință de resursă precum `?logo=lolly/logo/primary` devine un `{ id }` nerezolvat.
5. **Pornirea runtime-ului.** `createRuntime(tool, host, initialValues)` construiește modelul de intrare din datele de profil, valorile implicite și link, rezolvă referințele de resurse, încarcă hooks și apelează `onInit`.
6. **Randare.** Shell-ul se abonează la runtime, desenează controalele din model și scrie șablonul completat în `#tool-canvas`.
7. **Interacțiune.** Tastarea apelează `runtime.setInput`, care aplică restricțiile, apelează `onInput`, completează din nou șablonul și redesenează.
8. **Export.** **Download** apelează `runtime.export(node, format)`, iar `host.export` al shell-ului produce fișierul: un raster, un vector din walker-ul DOM, un PDF, un document sau unul dintre celelalte formate din `schemas/tool.schema.json`. Unitățile fizice sunt convertite per format, iar metadatele și Content Credentials sunt încorporate unde formatul le poate conține. Instrumentele experimentale primesc filigranul de la gazdă, nu de la instrument. [Șabloane și randare](/info/tool-rendering.html) și [Exportă un fișier](/info/exporting.html) acoperă pasul de export.

![Panoul de export pe care îl deschide ?options: perechea nume de fișier și format, dimensiunea de ieșire și controalele care scriu fișierul](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Același ciclu de viață rulează în Tauri și în CLI cu un DOM fără interfață, unde ieșirea merge într-un fișier sau stdout.

## Licențe

Codul, inclusiv `engine/`, `shells/`, `services/`, `schemas/` și generatorul de documentație, este MPL-2.0, într-un singur depozit public, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Proza documentației este CC BY-SA 4.0. Pachetele de brand își poartă propriii termeni în `NOTICE.md` al fiecărui pachet: instrumentele comunitare sunt MPL-2.0, iar pachetul privat SUSE este proprietar SUSE. [Despre](/info/about.html) are nota completă de licențiere.
