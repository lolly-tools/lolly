# Cum se compară Lolly

Ce face Lolly și uneltele creative de azi nu fac, și ce lasă în mod deliberat în seama lor.

Pentru versiunea unealtă cu unealtă, câte o pagină pentru Canva, Adobe, Figma, API-uri de randare și convertoare online, vezi [Lolly compared, tool by tool](/info/compare.html). Fiecare pagină precizează ce face mai bine cealaltă unealtă și ce face Lolly în schimb.

> **Stare pilot:** Lolly este un prototip aflat într-un pilot închis, nu un produs finalizat, iar securitatea sa se află în prezent în procesul strict de întărire a infrastructurii SUSE, în pregătirea pentru scară enterprise. Pagina [Adoption & Governance](/info/adoption-governance.html#status) acoperă starea actuală.

## Uneltele de azi

Fiecare inel de mai jos notează cât de complet livrează o clasă de produse o capabilitate **așa cum este livrată azi** - nu cum este promovată - fiecare clasă fiind notată pe baza celui mai bun reprezentant al ei. Lolly este notat cu același cuțit: primește singurul inel roșu de pe tablă, pentru maturitate. Deschide numele unui rând pentru raționamentul din spatele notelor sale. Coloanele sunt sortate după rândul Overall completeness din partea de sus - media rândurilor notate, cu rândul de cheltuieli exclus.

::: figure positioning-comparison
Completitudinea capacităților în uneltele creative de azi, cercetate în august 2026. Punctaj: 0 absent, 25 la nivel de soluție ocolitoare, 50 real dar restricționat sau parțial, 75 puternic cu rezerve, 100 competență de bază.
:::

**Note privind notarea.** Notele lui Lolly presupun că afirmațiile sale publicate sunt valabile, motiv pentru care maturitatea este singurul său inel roșu: pilot închis, întărirea securității în curs, nimic auditat încă. Cercetarea a modificat mai multe celule.

Canva este notat pe baza celui mai bun membru al familiei sale pentru fiecare rând, întrucât deține Affinity și Cavalry (ambele oferite gratuit în octombrie 2025). Randarea offline și pe dispozitiv obține 75 prin Affinity - o suită desktop care tot mai are nevoie de un cont verificat și poartă telemetrie, aceeași deducere pe care o suferă și Adobe - în timp ce modul offline propriu al Canva editează doar design-uri presincronizate, pe un singur dispozitiv, într-o fereastră limitată. Autofill obține 50: real, dar limitat la Enterprise, asincron, doar text și imagine. Generarea în masă a Figma a urcat de la 25 la 50 când Buzz a lansat completarea din foaie de calcul (beta gratuit, august 2026).

O singură regulă guvernează tabla: Full (100), pe rândurile care ating conținutul sau identitatea ta, necesită o capabilitate pe care o poți folosi fără cont și fără precondiție de cloud; rândurile care descriu produsul în sine (maturitate, ușurință în utilizare) sunt exceptate. Asta îl costă pe Adobe la proveniență: cea mai amplă implementare C2PA livrată (Photoshop, Lightroom, Premiere, Firefly) semnează local și în cloud, dar niciodată fără un cont și o identitate Adobe, deci 75. Din același motiv plafonează API-urile de randare la generare în masă și automatizare.

Nota 75 la proveniență a lui Lolly reflectă semnarea offline pe dispozitiv: arhitectural mai solidă, dar neauditată, iar o cheie de dispozitiv apare ca neverificată în validatorii standard până când o identitate sau propriul CA al unei organizații o girează. Nota 50 a Penpot vine prin plugin-ul oficial Lolly Export: aceeași semnare de motor, opțională, declarată ca fiind a lui Lolly. Penpot primește și singurul inel ieșit din scală de pe tablă, 90 la randare pe dispozitiv - canvas în browser, salvare în propriul tău cloud suveran (chiar și un laptop), export privat; doar pasul prin server îl separă de Lolly. Cloudinary primește propria coloană: un pipeline media (DAM, API de transformare, CDN) și singura coloană cloud care livrează C2PA (50, pentru că fl_c2pa semnează la livrare, atestând livrat-de-Cloudinary, nu creat-de-tine).

Colaborarea live merge invers: Figma stabilește reperul de scară (200 de editori), iar P2P-ul pereche, izolat (air-gapped) al lui Lolly primește Partial. Prețul este o estimare, etichetată ca atare: aritmetică pe prețul de listă pentru combinații realiste de locuri, deliberat largă, pentru scară, nu pentru achiziții. API-urile de randare primesc 75 la constrângeri: șabloane blocate, fără strat de guvernanță de brand.

Golul: nimic livrat astăzi nu este constraints-first și offline, fără cont și fără server pe calea de randare, iar nimeni nu a copiat clauza privind contul. Lolly livrează acum propriul canvas deschis - **Design**, un canvas liber cu manipulare directă - dar culorile, tipul și resursele de pe el se conformează valorilor globale de brand, așa că până și aranjarea liberă rămâne constraints-first.

Ce **nu** este Lolly încă este o suită de design fără constrângeri; designerii vor continua să folosească Illustrator și Figma pentru lucrări la comandă - iar atunci când acea lucrare trebuie să devină un asset guvernat, reproductibil, funcția [Import a design](/info/design-import.html) a uneltei Design aduce fișierul finit Figma, Penpot, Illustrator, InDesign sau PDF pe canvas sub formă de cutii editabile, conformate brandului.

![Canvas-ul liber al Design, unde culorile, fonturile și resursele oferite sunt cele ale brandului](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Folosește-l pentru

- Generare rapidă de resurse creative operaționalizate (tile-uri de evenimente, insigne, semnături, alerte)
- Aranjare liberă pe canvas-ul deschis (Design) atunci când piesele - culori, tip, iconițe, imagini - trebuie să rămână conformate valorilor globale de brand
- Aducerea unui design finit Figma, Penpot, Illustrator, InDesign sau PDF (funcția Import a design a uneltei Design) astfel încât să poată fi editat, guvernat și rerandat determinist în orice format Lolly
- Fluxuri de tipul "completează trei câmpuri, obții resursa finită", unu-la-mai-mulți - inclusiv rulări în masă dintr-o foaie de calcul/CSV în grila batch `/pro` (lipește sau importă rânduri, o resursă finită per rând, descarcă drept arhivă zip)
- Rezultate branduite, recurente, mereu active
- Situații în care controlul central al expresiei de brand contează mai mult decât flexibilitatea expresivă

Deck Studio este o măsură bună a plafonului aici: un întreg set de diapozitive declarat ca date, așezat în timp real pe canvas și exportat ca PowerPoint editabil nativ.

![Deck Studio în vizualizarea împărțită - diapozitivele setului listate ca blocuri în stânga, randarea setului așezat în dreapta](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Nu îl folosi pentru

- Conținut hero personalizat sau emblematic (panouri publicitare, videoclipuri majore)
- Lucrări de campanie unice care au cu adevărat nevoie de un designer
- Idee care trebuie să scape complet de sistemul de brand - canvas-ul deschis al lui Lolly tot conformează culorile, tipul și resursele valorilor globale de brand, și asta e esența

## Inovează probabilistic, scalează determinist

Majoritatea discursurilor de tip "AI creativ" pun modelul pe partea greșită a unei linii vechi. Scribii și miniaturiștii au stabilit deja unde trece această linie: lucrezi liber pe schiță, unde orice poate fi încercat și nimic nu este definitiv, iar apoi treci la tipar, care este intimidant tocmai pentru că se angajează. Schițele erau locul unde se afla arta. Tiparul era felul în care ea călătorea. Două instrumente, două funcții, fiecare inventiv în felul său, iar lucrarea tipărită putea fi de încredere pentru că tiparul își ținea promisiunea la fiecare tragere.

Lolly este tiparul, nu schița. Adu orice vrei la etapa de idee - un model, un designer, un șervețel - dar din momentul în care o idee trebuie să devină zece mii de resurse, ea trece prin ceva care randează la fel de fiecare dată, pornind de la date pe care oricine le poate citi înapoi. Despre asta este vorba de fapt în comparația de mai sus: nu cine are generatorul mai bun, ci cine face reproductibil pasul definitiv.

> Ai încredere în procesul creativ, scalează cu rigoare.

## Aprobă instrumentul, nu fișierul

Orice alt instrument de pe piață produce un *fișier* care apoi trebuie verificat - un manager de brand într-un fir de Slack, juridicul pe disclaimer, o rundă de modificări, o altă revizuire. Lolly mută aprobarea **cu un pas mai devreme**. Regulile de brand - codurile hex exacte, fișierele de fonturi licențiate, marginile de sângerare, spațierea - sunt integrate direct în HTML-ul și CSS-ul instrumentului, astfel încât șablonul *nu poate* produce un asset care nu respectă brandul. Layout-ul însuși aplică regulile.

Așadar nu mai aprobi rezultatele, ci începi să aprobi **instrumentul** care le produce. Îl aprobi o singură dată, iar fiecare asset pe care îl produce vreodată este pre-aprobat prin construcție - fără om în buclă, fără ciclu de revizuire, la orice volum.

Aceasta este schimbarea pe care motorul determinist o aduce cu adevărat: nu e o versiune mai rapidă a vechiului proces de aprobare, ci elimină procesul. Pentru echipa creativă e o barieră de siguranță, nu un înlocuitor - tu tot arunci mingea (datele, textul, imaginea), iar codul este culoarul cu bumperi care ține fiecare aruncare departe de șanț.

![Toată treaba producătorului: să tasteze cuvintele. Tipul de literă, culoarea și spațierea au fost stabilite când instrumentul a fost aprobat](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Aprobarea asseturilor în modul vechi | Aprobarea instrumentului, în stilul Lolly |
|---|---|
| Fiecare fișier finalizat este verificat, unul câte unul | Instrumentul este verificat o singură dată |
| Cerere → designerul construiește → revizuire de brand → verificare juridică → modificări → re-revizuire | O schimbare de parametru → asset finalizat |
| Designer, manager de brand, juridic și solicitant, toți implicați | Producătorul, singur |
| Zile per asset | Secunde per asset |
| 10.000 de assets = 10.000 de cicluri de revizuire | 10.000 de assets = zero (șablonul era deja aprobat) |

## Ce oferă acest lucru, în mod unic

- **Potențial de design îndrăzneț livrat în siguranță, în context.** Instrumentele pot exprima idei de design îndrăznețe în interiorul unor bariere de siguranță integrate direct în cod.

- **Automatizare de conținut definită prin software, care returnează assetul final.** Input → fișier final. Nu mai există „acum salvează-l din instrumentul tău de design și procesează-l ulterior”.
- **Instrumentele compun instrumente.** Un instrument poate integra randarea altui instrument și îl poate returna ca parte a unui singur asset finalizat, fără cuplare de cod între instrumente - o capacitate pe care niciun produs de tip canvas deschis sau șablonare DAM de pe piață nu o oferă.
- **Neutralitate față de furnizori.** Control total asupra funcționalităților și costurilor. Motor open-source. Instrumentele și asseturile sunt conținut urmărit în git, nu blocat într-o bază de date SaaS.

Primul dintre acestea este cel pe care oamenii îl subestimează. O hartă de oraș la nivel de poster, desenată ca trasee vectoriale reale de drumuri și ape, dintr-un meniu derulant și două câmpuri de culoare care nu pot fi îndreptate în afara brandului:

![Inelele de canale și rețeaua de drumuri din Amsterdam, desenate din margine în margine cu cerneala proprie a brandului, fiecare linie plasată de șablon, nu de mână](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Suveranitatea conținutului

Există un nume pentru ceea ce înseamnă, în esență, secțiunea anterioară: suveranitate. Fluxul tău de procesare media rulează pe hardware pe care îl deții. Brandul tău - tokenii, fonturile, logourile, instrumentele care le impun - trăiește în fișiere pe care le deții, în control de versiuni pe care îl controlezi tu, nu într-o bază de date a unui furnizor cu un buton de export. Randarea are loc pe dispozitivul din fața ta, astfel încât un asset nu tranzitează niciodată o terță parte ca să existe, iar întregul traseu de la input la fișierul finalizat este open-source și verificabil. Dacă mâine ar dispărea orice furnizor SaaS de design, o instalare Lolly nici n-ar observa.

Acest lucru contează pentru oricine a cărui muncă ar trebui să supraviețuiască unui abonament: părintele a cărui carte foto trăiește pe acel laptop la fel de mult ca instituția publică a cărei bibliotecă de brand se supune unor reguli de achiziții. Pentru organizații - instituții publice, industrii reglementate, oricine al cărui brand este un asset strategic, nu o decorație - „unde trăiește conținutul nostru și cine îl poate opri” este o întrebare de guvernanță, nu o preferință. Suveranitatea, aici, este o proprietate a arhitecturii, nu o funcție de găzduire adăugată pentru conformitate, iar paginile [Politica de confidențialitate](/info/privacy.html) și [Verifică singur](/info/verify-yourself.html) există ca să poți verifica această afirmație, nu doar să o crezi pe cuvânt.

Dedesubtul tuturor acestora se află o singură promisiune, formulată ca angajament, nu ca funcție: **dacă se randează pe dispozitivul tău, este gratuit pentru totdeauna.** Motorul, shell-urile, instrumentele, formatele - întregul traseu creativ pe dispozitiv este open-source și rămâne așa. Această promisiune are un mecanism: o versiune care a fost lansată este licențiată astfel încât nu poate fi retrasă, și nu există niciun acord de contribuție care ar putea relicenția munca ulterior. Toată granița încape într-o singură propoziție: tot ce se randează pe dispozitivul tău este gratuit și open-source, pentru totdeauna; coordonarea oamenilor și a mașinilor într-o rețea este treaba unui plan de control separat, [lolly.work](https://lolly.work).
