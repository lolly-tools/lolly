# Cum se compară Lolly

Lolly înseamnă două părți ale unui singur proiect open source. **Lolly** este motorul, aplicațiile și instrumentele pentru a crea, edita, converti și exporta pe dispozitivul tău, fără cont. **Lolly Work** este serverul organizației, rulat pe infrastructura ta, pentru autentificare, proiecte comune, aprobări și randare pe server. Ambele sunt MPL-2.0. Această pagină compară perechea cu celelalte moduri în care oamenii proiectează, guvernează și produc fișiere.

## Uneltele de azi

Fiecare inel notează cât de complet livrează o clasă de produse o capabilitate, fiecare clasă fiind notată pe cel mai bun reprezentant al ei. Coloana Lolly acoperă Lolly și Lolly Work împreună, iar fiecare rând spune ce parte oferă ce. Deschide numele unui rând pentru raționamentul din spatele notei. Coloanele sunt sortate după rândul Overall completeness de sus: media rândurilor notate, cu rândul de cheltuială exclus.

::: figure positioning-comparison
Comparație de capabilități: cercetarea competitorilor și notele din august 2026; acoperirea Lolly + Lolly Work revizuită la 28 septembrie 2026. Notare: 0 absent, 25 soluție improvizată, 50 real dar limitat sau parțial, 75 puternic cu rezerve, 100 competență de bază.
:::

::: details Note de notare
Funcțiile disponibile și maturitatea în producție sunt separate. Lolly este lansat: versiunea 1.0 a apărut ca open source la 30 august 2026, securitatea lui nu a avut încă un audit independent, iar dovezile lui de adopție au câteva luni ([Adopție și guvernanță](/info/adoption-governance.html#status) are starea curentă). Faptul de a avea single sign-on, aprobări sau randare pe server nu stabilește un istoric de producție, deci nota de maturitate reflectă asta. Notele competitorilor își păstrează revizuirea datată din august.

O regulă guvernează tabloul. Nota maximă (100), pe rânduri care ating conținutul sau identitatea ta, necesită o capabilitate pe care o poți folosi fără cont și fără precondiție de cloud; rândurile despre produsul însuși, precum maturitatea și ușurința în utilizare, sunt scutite. Regula aceasta îl costă pe Adobe la Content Credentials: cea mai largă implementare livrată (Photoshop, Lightroom, Premiere, Firefly) semnează local și în cloud, dar niciodată fără un cont și o identitate Adobe, deci 75. Plafonează API-urile de randare la generare în masă și automatizare din același motiv.

Canva este notat pe cel mai bun membru al familiei pe rând, deoarece deține Affinity și Cavalry (ambele oferite gratuit în octombrie 2025). Randarea offline și pe dispozitiv primește 75 prin Affinity, o suită desktop care încă necesită un cont verificat și poartă telemetrie, aceeași deducere pe care o ia și Adobe; modul offline propriu al Canva editează doar designuri presincronizate, pe un singur dispozitiv, pentru o fereastră limitată. Autofill primește 50: este real, dar rezervat Enterprise și asincron, și completează doar text și imagini. Generarea în masă a Figma a crescut de la 25 la 50 când Buzz a lansat completarea din foaie de calcul (un beta gratuit, august 2026).

Nota 75 a Lolly la Content Credentials acoperă semnarea pe dispozitiv și semnarea pe server a Lolly Work cu o identitate de organizație configurată; un verificator trebuie totuși să aibă încredere în semnatar ([Identitate Content Credentials](/info/content-credentials-identity.html)). Nota 50 a Penpot vine prin pluginul de export propriu al Lolly pentru Penpot: aceeași semnare a motorului, opt-in și dezvăluită ca a Lolly. Penpot primește 90 la randarea pe dispozitiv: un canvas de browser cu o țintă de salvare pe serverul lui, care poate fi găzduit propriu. Cloudinary primește propria coloană pentru biblioteca de resurse, API-ul de transformare și CDN-ul; revizuirea din august a notat semnarea livrării lui cu 50.

Colaborarea live a Lolly include collab-uri private directe între două dispozitive și work collab-uri autentificate prin Lolly Work, cu editări comune, cursoare și sesiuni de echipă salvate. Nota Partial reflectă instalarea work curentă pe un singur nod și istoricul scurt de operare, nu absența editării în echipă. Estimările de preț sunt aritmetică datată pe prețuri de listă pentru ordin de mărime, nu achiziții.
:::

## Când să alegi Lolly

::: cols
## Alege Lolly când

- Același fel de fișier este necesar iar și iar: plăci de eveniment, ecusoane, certificate, alerte, carduri sociale
- Multe fișiere vin dintr-un singur șablon și un tabel de valori, în [Batch](/info/batch.html#make-many-versions-of-one-design) sau CLI
- Culorile, fonturile și resursele trebuie să rămână în sistemul de design, chiar și pe un canvas deschis
- Un design terminat din Figma, Penpot, Illustrator, InDesign sau PDF trebuie să devină editabil și repetabil ([Importă un design](/info/design-import.html))
- Fișierele trebuie făcute pe propriile tale dispozitive sau servere

## Alege altceva când

- Munca este retușare foto detaliată sau ilustrație
- Proiectezi și prototipezi o interfață de aplicație
- Ai nevoie de o bibliotecă mare de stock și șabloane gata din prima zi
- Ai nevoie de un serviciu administrat cu un istoric îndelungat la scară
:::

Designurile importate și design tokens partajate lasă o echipă să combine Lolly cu aplicații specializate, în timp ce Lolly Work guvernează resursele comune, revizuirea și livrarea.

Un deck întreg arată plafonul: în **Markdown Slides** un deck este declarat ca date, așezat live și exportat ca fișier PowerPoint nativ, editabil.

![Markdown Slides în vederea împărțită: diapozitivele deck-ului listate ca blocuri în stânga, deck-ul așezat randat în dreapta](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Regulile trăiesc în instrument

Lolly pune regulile reutilizabile de brand în instrument: culori, fonturi, margini de bleed, spațiere și intrări permise. Șablonul fixează părțile pe care un destinatar nu trebuie să le schimbe. Lolly Work adaugă în jurul acelui șablon acces pe grupuri și politici de intrare, cu lanțuri de aprobare pentru trimiterile în catalog și livrare.

Verificarea unui instrument o dată face producția repetabilă mai ușoară, pentru că fiecare rezultat își moștenește regulile de layout. Textul, imaginile încărcate și drepturile de utilizare pot necesita totuși verificare, iar Lolly Work oferă cataloage comune și pași de aprobare pentru asta. Pentru echipa creativă, instrumentul este un parapet: tu aduci în continuare datele, textul și imaginea, iar instrumentul ține fiecare rezultat în stilul brandului.

![Toată treaba producătorului: tastează cuvintele. Tipografia, culoarea și spațierea au fost stabilite când a fost făcut instrumentul](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Încă trei lucruri deosebesc această abordare:

- **Fișierul final, din intrări.** Intrare înăuntru, fișier terminat afară, fără „acum salvează-l din instrumentul de design și retușează-l”.
- **Instrumentele compun instrumente.** Un instrument poate încorpora randarea altui instrument într-un singur fișier terminat, fără cuplare de cod între ele.
- **Deschis până jos.** Motorul este open source, iar instrumentele, resursele și design tokens sunt fișiere pe care le poți păstra în controlul versiunilor sau gestiona în Lolly Work, nu rânduri în baza de date a altcuiva.

Designul aventuros supraviețuiește parapetelor. Această hartă de oraș de calitate de afiș este cale vectorială adevărată de drumuri și apă, dintr-o listă derulantă și două câmpuri de culoare care nu pot fi îndreptate în afara sistemului de design:

![Inelele de canale și rețeaua de drumuri din Amsterdam desenate de la margine la margine în cerneala proprie a sistemului de design, fiecare trasă plasată de șablon, nu de mână](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Inovează probabilistic, scalează determinist

Cele mai multe pitch-uri „AI creativ” pun modelul de partea greșită a unei linii vechi. Copiștii și miniaturiștii au stabilit unde cade. Lucrezi liber la schiță, unde se poate încerca orice și nimic nu e fixat. Apoi mergi la tipar, care fixează. Schițele erau locul unde era arta, iar presa era modul în care ea călătorea, iar lucrarea tipărită putea fi de încredere pentru că presa își ținea promisiunea la fiecare tragere.

Lolly este presa. Adu ce vrei la idei, un model, un designer sau un desen brut, dar în clipa în care o idee trebuie să devină multe fișiere, trece printr-un proces care randează la fel de fiecare dată, din intrări pe care oricine le poate citi înapoi. Comparația de mai sus este de fapt despre cine face repetabil acel pas fixat.

> Ai încredere în procesul creativ, scalează cu rigoare.

## Gratuit pentru totdeauna

**Dacă randează pe dispozitivul tău, este gratuit pentru totdeauna.** Motorul, shell-urile, instrumentele și formatele sunt open source, iar o versiune lansată nu poate fi retrasă. Și Lolly Work este open source. O organizație plătește pentru infrastructura și operarea pe care le alege, fără taxă de licență software per loc sau per randare pentru găzduire proprie. [Întrebări și răspunsuri](/info/faq.html) spune povestea din spatele promisiunii.

## Unde trăiește conținutul tău

Munca creativă a Lolly poate rula pe hardware pe care îl deții, iar design tokens, fonturile, logourile și instrumentele lui sunt fișiere pe care le poți păstra. Cu Lolly Work, proiectele comune, resursele, politica și înregistrările de audit trăiesc în stocarea configurată de organizația ta. [Încredere](/info/trust.html) explică de ce contează, iar [Politica de confidențialitate](/info/privacy.html) și [Verifică singur](/info/verify-yourself.html) te lasă să verifici afirmația, nu s-o iei pe cuvânt.

## Instrument cu instrument

[Lolly comparat, instrument cu instrument](/info/compare.html) compară Lolly cu Canva, Adobe, Figma, Penpot, portaluri de brand, API-uri de randare și convertoare online, câte o pagină fiecare, și prezintă [ce rulează unde](/info/compare.html#what-runs-where).
