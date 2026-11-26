# Cum se compară Lolly

Lolly creează fișiere conforme cu brandul pe dispozitivul tău, fără cont. **Lolly Work** este serverul pentru echipe: autentificare, proiecte partajate, aprobări și randare pe server, pe mașini operate de organizația ta. Ambele sunt open source sub MPL-2.0.

Cele mai multe echipe păstrează instrumentele pe care le au. O aplicație de design furnizează designurile, un DAM rămâne sursa de referință, iar Lolly transformă intrările aprobate în fișiere terminate. [Folosește Lolly cu DAM-ul tău existent](/info/use-with-dam.html) descrie această combinație. Ideea din spatele combinației este [suveranitatea conținutului](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Instrumentele de astăzi

Fiecare inel arată cât de complet răspunde o clasă de produse unei nevoi. Apasă un **?** lângă un rând ca să vezi dovezile și **?** de lângă legendă ca să vezi cum funcționează punctajele.

::: figure positioning-comparison
Comparația capabilităților. Cercetare despre concurenți din documentele furnizorilor, din august până la 21 noiembrie 2026. Lolly și Lolly Work evaluate la 21 noiembrie 2026. Punctaj: 0 absent, 25 soluție ocolitoare, 50 real, dar cu acces restricționat sau parțial, 75 puternic, cu rezerve, 100 competență de bază.
:::

::: details Surse pentru punctajele care s-au schimbat în noiembrie 2026
- Canva: [jurnalul modificărilor API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [aplicații de serviciu](https://www.canva.dev/blog/developers/canva-service-accounts/), [ajutor pentru Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [jurnalul modificărilor InDesign API](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [prețuri Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [credite pentru agenți și AI](https://help.figma.com/hc/en-us/articles/42614902212887), [server MCP](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify și Bynder: [nota de lansare Frontify din octombrie 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear și Placid: [prețuri Bannerbear](https://www.bannerbear.com/pricing/), [jurnalul modificărilor Bannerbear](https://www.bannerbear.com/changelog/), [prețuri Placid](https://placid.app/pricing)
- Penpot: [prețuri pentru găzduire proprie](https://penpot.app/pricing/self-host), [versiuni lansate](https://github.com/penpot/penpot/releases)
- Cloudinary: [proveniența conținutului](https://cloudinary.com/documentation/content_provenance_and_authenticity), [prețuri](https://cloudinary.com/pricing)
:::

Funcțiile și istoricul de utilizare sunt rânduri separate. Prima versiune publică Lolly a fost 1.0.1, pe 30 august 2026, securitatea sa nu a avut încă un audit independent, iar dovezile adoptării au doar câteva luni. [Adoptare & guvernanță](/info/adoption-governance.html#status) prezintă starea curentă.

<!--i:eti-hammer-->
## Când să alegi Lolly

::: cols
## Alege Lolly când

- Ai nevoie de același tip de fișier în mod repetat: carduri pentru evenimente, ecusoane, certificate, alerte, carduri pentru rețele sociale
- Multe fișiere provin dintr-un șablon și un tabel de valori, în [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) sau în CLI
- Culorile, tipografia și resursele trebuie să rămână în limitele sistemului de design, chiar și pe un canvas liber
- Un design terminat în Figma, Penpot, Illustrator, InDesign, Affinity sau PDF trebuie să devină editabil și repetabil ([Importă un design](/info/design-import.html))
- Fișierele trebuie create pe propriile dispozitive sau servere

## Alege altceva când

- Munca presupune retușare foto detaliată sau ilustrație
- Proiectezi și prototipezi interfața unei aplicații
- Ai nevoie de o bibliotecă mare de resurse și șabloane gata din prima zi
- Ai nevoie de un serviciu administrat cu un istoric îndelungat de utilizare la scară mare
:::

Designurile importate și tokenurile de design partajate permit unei echipe să combine Lolly cu aplicații specializate, în timp ce Lolly Work guvernează resursele partajate, revizuirea și livrarea.

Pentru echipele cu un DAM cu resurse atent selectate, începe prin a păstra biblioteca și administratorii ei. [Experiența SUSE cu Brandfolder](/info/suse-brandfolder.html) documentează modul în care integrarea a susținut adoptarea și gestionarea schimbărilor în procesul de aprobare. Furnizorii DAM și partenerii de implementare pot evalua aceeași configurație prin [fluxul de lucru pentru parteneri](/info/dam-partners.html).

În **Lolly Markdown Slides**, un deck întreg este scris ca date, aranjat live și exportat ca fișier PowerPoint nativ, editabil.

![Lolly Markdown Slides în vizualizarea împărțită: diapozitivele deck-ului listate ca blocuri în stânga, randarea deck-ului aranjat în dreapta](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Regulile sunt în instrument

Lolly pune regulile reutilizabile ale brandului în instrument: culori, fonturi, margini de bleed, spațiere și intrări permise. Șablonul fixează părțile pe care destinatarul nu trebuie să le schimbe. Lolly Work adaugă acces pe grupuri și politici pentru intrări în jurul acelui șablon, cu lanțuri de aprobare pentru propunerile trimise în catalog și pentru livrare.

Verificarea unui instrument o singură dată ușurează producția repetabilă, deoarece fiecare rezultat moștenește regulile lui de layout. Textele, imaginile încărcate și drepturile de utilizare pot avea în continuare nevoie de verificare, iar Lolly Work oferă cataloage partajate și pași de aprobare pentru asta. Pentru echipa de creație, instrumentul este o barieră de protecție: tu aduci în continuare datele, textul și imaginea, iar instrumentul păstrează fiecare rezultat conform cu brandul.

![Toată munca celui care produce fișierul: să scrie cuvintele. Tipografia, culoarea și spațierea au fost stabilite când a fost creat instrumentul](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Încă trei diferențe:

- **Fișierul final, din intrări.** Introduci datele, primești fișierul terminat, fără „acum salvează-l din instrumentul de design și corectează-l”.
- **Instrumentele compun instrumente.** Un instrument poate încorpora randarea altui instrument într-un singur fișier terminat, fără cuplare la nivel de cod între ele.
- **Open source.** Motorul este open source, iar instrumentele, resursele și tokenurile de design sunt fișiere pe care le poți păstra sub controlul versiunilor sau gestiona în Lolly Work, nu rânduri în baza de date a altcuiva.

Designul îndrăzneț rezistă în limitele de protecție. Această hartă urbană de calitate pentru afișe conține căi vectoriale reale pentru drumuri și ape, obținute dintr-o listă derulantă și două câmpuri de culoare care nu permit alegeri în afara sistemului de design:

![Inelele de canale și rețeaua de drumuri din Amsterdam desenate de la o margine la alta în culorile proprii ale sistemului de design, fiecare contur plasat de șablon, nu manual](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Inovează probabilistic, scalează determinist

Cele mai multe prezentări de „creativitate cu AI” pun modelul de partea greșită a unei delimitări vechi. Copiștii și miniaturiștii au stabilit unde se află. Lucrezi liber la schiță, unde orice poate fi încercat și nimic nu este definitiv. Apoi treci la tipar, care fixează rezultatul. Arta era în schițe, iar tiparul o răspândea, și puteai avea încredere în lucrarea tipărită fiindcă presa își respecta promisiunea la fiecare imprimare.

Lolly este presa. Adu orice vrei la etapa ideilor, un model, un designer sau un desen sumar, dar în momentul în care o idee trebuie să devină multe fișiere, ea trece prin ceva care randează la fel de fiecare dată, din intrări pe care oricine le poate reciti. Comparația de mai sus este, de fapt, despre cine face repetabil acel pas de fixare a rezultatului.

> Ai încredere în procesul creativ, scalează cu rigoare.

<!--i:eti-tag-->
## Gratuit pentru totdeauna

**Dacă se randează pe dispozitivul tău, este gratuit pentru totdeauna.** Motorul, interfețele de rulare, instrumentele și formatele sunt open source, iar o versiune lansată nu poate fi luată înapoi. Lolly Work este și el open source. O organizație plătește pentru infrastructura și operarea pe care le alege, fără taxă de licență software per utilizator sau per randare pentru găzduirea proprie. [Întrebări & răspunsuri](/info/faq.html) spune povestea din spatele promisiunii.

<!--i:eti-map-pin-->
## Unde se află conținutul tău

Munca de creație în Lolly poate rula pe hardware pe care îl deții, iar tokenurile de design, fonturile, logourile și instrumentele sale sunt fișiere pe care le poți păstra. Cu Lolly Work, proiectele partajate, resursele, politica și înregistrările de audit se află în stocarea configurată de organizația ta. [Încredere](/info/trust.html) explică de ce contează asta, iar [Politica de confidențialitate](/info/privacy.html) și [Verifică singur](/info/verify-yourself.html) îți permit să verifici afirmația în loc să ne crezi pe cuvânt.

<!--i:eti-grid-->
## Instrument cu instrument

[Lolly comparat, instrument cu instrument](/info/compare.html) compară Lolly cu Canva, Adobe, Figma, Penpot, portaluri de brand, API-uri de randare și convertoare online, câte o pagină pentru fiecare, și explică [ce rulează unde](/info/compare.html#what-runs-where).
