# Lolly pentru dezvoltatori

Documentația tehnică - pentru oricine creează instrumente, integrează Lolly într-un pipeline, îl găzduiește singur sau extinde platforma.

**Ce câștigi tu din asta.** Construiește un instrument o singură dată, iar cererea nu mai revine la tine. Veșnicul „poți să-mi faci repede un…” care îți mănâncă după-amiezile devine un template pe care alții îl completează singuri - corect, fără ca tu să fii în buclă. Munca ta e HTML/CSS/JS simplu: versionată, diffabilă, revizuibilă și rulează pe un motor deschis, fără dependență de furnizor - așa că rămâne a ta. Automatizează rularea de producție, iar timpul tău se duce spre problema interesantă, nu spre al zecemiilea export.

Lolly este un **motor** agnostic de platformă care rulează același traseu de randare pe mai multe **shell-uri** (web PWA, Tauri desktop/mobil, CLI, TUI). Instrumentele sunt **date, nu cod împachetat** - un manifest plus un template plus hook-uri opționale - astfel încât instrumentele noi sunt livrate fără o actualizare a aplicației. Începe cu [Prezentare generală](/info/overview.html) pentru arhitectură, apoi urmează traseul potrivit pentru ceea ce construiești.

Ești nou pe platformă? **[Pornire rapidă](/info/quickstart.html)** pune la punct un brand și primul tău render înainte să intri în profunzime.

## Înțelege arhitectura



- **[Prezentare generală](/info/overview.html)** - de ce există Lolly, separarea motor/shell/instrumente, podul de capabilități și angajamentele arhitecturale stabilite definitiv.
- **[Design Tokens](/info/design-tokens.html)** - modelul de tokeni DTCG în care sunt exprimate brandurile și cum îi consumă instrumentele.

## Creează instrumente

Fiecare control de mai jos a fost generat dintr-un input declarat în `tool.json`. Tu scrii linia din manifest, hostul desenează widgetul, iar același model conduce și CLI-ul și URL-ul.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

Asta scalează mult peste cinci controale. Dă unui input o `section` și hostul îl pliază, așa că un instrument cu cincizeci de inputuri precum D3 Chart Studio se deschide tot ca o listă scurtă, restul fiind aranjat în grupuri denumite.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Crearea instrumentelor](/info/authoring-tools.html)** - ghidul complet: manifest, template, stiluri, hook-uri, compunere și publicare.
- **[Crearea resurselor](/info/authoring-assets.html)** - resurse din catalog, niveluri, localizări, palete, icoane tematizabile și fonturi.
- **[Host API](/info/host-api.html)** - podul de capabilități `HostV1` pe baza căruia e scris fiecare instrument (singura API pe care o văd instrumentele).
- **[URL Mode](/info/url-mode.html)** - fiecare input ca parametru URL; parametri rezervați, codificare compactă, linkuri împachetate.

## Rulează și integrează

- **[CLI](/info/cli.html)** - randare headless; același traseu de randare ca GUI-ul, condus de argumente `--foo=bar`.
- **[TUI](/info/tui.html)** - shell-ul interactiv de terminal.
- **[Server MCP](/info/mcp.html)** - endpoint-ul nativ care permite unui agent AI să descopere și să ruleze instrumente.
- **[Agenți AI](/info/ai-agents.html)** - controlează Lolly dintr-un model: un URL este API-ul.
- **[Extensia Chrome](/info/extension.html)** - capturează un URL live ca resursă reutilizabilă.

## Livrează și operează

- **[Ghidul de build](/info/build-guide.html)** - construiește fiecare țintă: CLI, TUI, desktop, mobil.
- **[Deployment](/info/deployment.html)** - aplicația web, aplicațiile și serviciile backend; unde rulează fiecare componentă.
- **[Configurare](/info/configuration.html)** - profiluri, pachete de brand, condiționare prin capabilități, feature flags și validarea catalogului.

## Încredere și date

Drepturile și paternitatea sunt inputuri ca oricare altele. Embed & Track Image declară câmpuri pentru autor, copyright, licență și contact, iar exportul le scrie în metadatele proprii ale fișierului și în manifestul său C2PA.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Identitate Content Credentials](/info/content-credentials-identity.html)** - semnare emisă de o CA pentru C2PA pe dispozitiv; contractele motorului și runbook-ul operatorului.
- **[Transfer de date](/info/data-transfer.html)** - pachetul `lolly-backup`: plic, integritate și garanții între shell-uri.
- **[Despre](/info/about.html)** - proiectul, limitele licenței sale și repository-ul.
