# FAQ

Întrebări frecvente afișate în acordeonul de pe pagina de destinație `/info`.

**Cum se întreține:** fiecare titlu `##` de mai jos este o întrebare; tot ce se află sub el
(până la următorul `##`) este răspunsul. Răspunsurile folosesc același markdown simplu ca
restul site-ului - separă paragrafele cu o linie goală. Adaugă, șterge sau
reordonează întrebările aici și rulează din nou `npm run build:info` (sau `npm run dev:web`).
Tot ce se află deasupra primului `##` (acest titlu și aceste note) este ignorat de build.

## Ce se întâmplă când îmi dau acordul pe pagina /profile?

Când folosești Lolly prima dată, tot ce scrii oriunde rămâne complet privat până când vrei tu, în mod deliberat, ca informația să iasă în lume printr-un fișier media sau un link de partajare (dacă ești online).

Cu acordul activat, detaliile de profil pe care le alegi sunt sigilate în ceea ce creezi, indicându-te ca sursă. Nimic nu este inclus fără să alegi tu.

Lolly produce un volum mare de conținut. Adoptăm o abordare strictă de minimizare a datelor, ca să prevenim riscurile.

## Lolly a fost „vibe coded”?

Lolly a fost dezvoltat cu programare asistată de AI, descoperire asistată de AI și, în multe locuri, conținut asistat de AI, folosind un mix de modele și furnizori, inclusiv de la companii de frontieră din cloud public.

La data redactării, Lolly nu conține nicio vulnerabilitate de securitate cunoscută în lanțul de aprovizionare și se angajează la practici de răspuns rapid în materie de securitate atunci când apar CVE-uri.

Un om a creat arhitectura, a curatoriat codul cu intenție și a direcționat artistic experiența.

Cel mai important, Lolly se sprijină pe umerii a zeci de ani de inovație open source din partea unor experți reali din întreaga lume.

În baza de cod a Lolly există o poartă de build deterministă, care păstrează codul și documentația coerente pentru cititorul obișnuit și „de-slop-uiește” experiența. Acest lucru poate îngreuna enumerarea sintetică proprietară a originii. Asta este neintenționat.

**Declarație privind AI generativă:**

- **Cod scris de LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (această listă poate crește)
- **Descoperire prin LLM:** Gemini 3.1, Fable
- **Documentație:** Sonnet 5
- **Biblioteci open source:** autorii lor respectivi, menționați în SBOM, comentarii și antetele fișierelor

Această listă nu include modelele integrate direct în Lolly.

**Contribuție umană:**

- **Arhitectură:** Andy Fitzsimon
- **Direcție artistică:** Andy Fitzsimon
- **Cod scris de om:** Andy Fitzsimon
- **Idei, recenzie și feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, comunitatea Penpot (lista nu este exhaustivă)

## Ce sunt feature flags?

Feature flags activează sau dezactivează părți din Lolly. De obicei le controlează un administrator - în Lolly, controlul îl ai tu.

![Fiecare feature flag este un comutator care îți aparține, aflat în propriul tău profil, nu în consola unui administrator](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Cum obțin aplicațiile pentru mobil sau desktop?

Oricine își poate distribui propriile aplicații, iar instrumentele și configurația acestor aplicații ar trebui să difere mult în funcție de publicul căruia i se adresează. Deci nu există o singură aplicație, decât dacă ai făcut-o tu sau ți-o dă cineva relevant.

## De ce numele "Lolly Tools"?

**Lolly** pentru că libertatea este dulce și pentru că în Australia, Noua Zeelandă și Marea Britanie "lolly" înseamnă bomboană.

**Tools** pentru că o unealtă stă nemișcată până când o iei în mână. Nu funcționează când nu o folosești și nu te supraveghează cât timp o folosești.

## La ce obstacole mă pot aștepta când adopt Lolly?

Lolly se integrează oriunde generezi deja fișiere - CLI-ul este același motor
ca aplicația, așa că o rulare de pipeline la 2 noaptea nu se poate abate de la ce vede cineva
în previzualizare, într-un browser. Frecarea la adopție este rareori tehnică; este organizațională. Așteaptă-te la:

**Trebuie creat un catalog de brand curatoriat.** Lolly este o platformă, nu un
pachet gata făcut cu șabloanele tale. Pentru o *implementare guvernată*, cineva definește catalogul comun
de resurse (logouri, palete, fonturi ca ID-uri permanente) și scrie manifestul +
șablonul pentru fiecare tip de rezultat. Persoanele individuale nu trebuie totuși să aștepte asta - în
aplicația deschisă oricine își poate încărca propriile fișiere în catalog și poate construi instrumente în
Design din prima zi.

**Nu ai nevoie de git ca să contribui.** Designerii își fac propriile instrumente și șabloane
în aplicație, apoi le împart cu colegii sau le trimit celui care deține
instalarea, pentru a fi incluse implicit.

**Este restrâns în mod deliberat - prezintă-l ca atare.** Lolly nu este pentru conținut la comandă
sau de tip vedetă. *Este* propriul tău DAM - alimentat și potențat de sistemul tău de design,
de instrumente și de catalog - și *are* un canvas deschis (Design), dar
și acolo culorile, tipografia și resursele respectă variabilele globale de design active, așa că aranjarea
liberă rămâne în interiorul sistemului. Comparat cu Figma sau Canva, va părea
limitat. Judecat pentru ceea ce este - generare de resurse operaționalizată,
recurentă, la scară masivă - nimic nu îl concurează. Încadrarea greșită este cel mai frecvent obstacol.

**Managementul schimbării de partea celor care produc.** Procesele existente funcționează azi, chiar dacă
rezultatul nu respectă brandul. Redirecționarea lor către motor înseamnă retestare și reînvățare,
iar "putem face deja fișiere" devine scuza de a nu migra. Începe prin a converti
un singur rezultat de calitate de producție, cu vizibilitate mare, și arată alăturat înainte/după.

Lolly ridică ștacheta peste tot.


## Prin ce se deosebesc utilitarele de instrumente?

**Răspunsul simplu →** Utilitarele nu au întotdeauna nevoie să randeze și de aceea pot avea un UX diferit. 

**Răspunsul real →** Motivul pentru care utilitarele pot fi găzduite în Lolly Tools este să adauge încă un "strat de comoditate" de apărare, care să descurajeze exfiltrarea de date. 

De ce? Pentru că se știe că, zilnic, oamenii iau **conținut confidențial pe care îl au deja** și îl dau unui
site oarecare pentru o singură operațiune mecanică măruntă:

- "**Comprimă acest PDF**" → încarcă un contract / fluturaș de salariu / prezentare de consiliu către entități necunoscute.
- "**convertește HEIC în JPG**" → încarcă fotografii personale (cu GPS EXIF) pe o gazdă finanțată din reclame
- "**decupează / redimensionează această imagine**" → încarcă o captură a unui produs sau o resursă nelansată
- "**formatează acest JSON**" / "decodează acest JWT" → lipește răspunsuri de API, token-uri și secrete într-un instrument de formatare
- "**unește aceste PDF-uri**" → încarcă **două documente care nu ar trebui să stea niciodată pe același server**

Aceste site-uri și lunga lor coadă de clone **nu sunt de încredere în mod implicit**: retenție
necunoscută, jurisdicții necunoscute, subprocesatori necunoscuți și un model de afaceri bazat pe
reclame/afiliere, care are toate motivele să păstreze ce le dai. Operațiunea este
banală; **conținutul este prețul.** 

Câștigăm războiul guvernanței prin comoditate și servicii excelente. 

![Vederea Utilitare adună sarcinile mecanice pe care oamenii le dau de obicei unui site oarecare, toate rulând în schimb în Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Poate Lolly să editeze și să randeze fișierele mele Figma, Penpot, Illustrator sau InDesign?

Da. Deschide **Design** și apasă **Import a design** (Importă un design): acceptă un fișier nativ Figma **.fig** (Save local copy), un export Penpot **.penpot**, un Illustrator **.ai** sau **.pdf**, un InDesign **.idml** (File → Export → InDesign Markup) sau **orice SVG** (ușa largă - aproape orice aplicație de design îl exportă). Fără cont, fără plugin și fără licență de aplicație de design.

![Design's open canvas - Import a design sits in the toolbar's Lolly menu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Straturile ajung ca niște casete editabile pe canvasul deschis: textul rămâne rescriabil, formele rămân forme, imaginile intră în propria ta bibliotecă de imagini, iar tipografia și culorile respectă variabilele globale ale brandului. Salvează-l și macheta devine un șablon reutilizabil, adresabil prin URL, pe care oricine are Lolly îl poate reumple - și poți amesteca în el instrumente vii (un cod QR, un grafic) care se re-randează la încărcare. De acolo se randează ca orice altceva în Lolly - SVG, PDF, PNG și restul, reproductibil din URL-ul său. Vezi [Importă un design](/info/design-import.html).

## Pot să îmi partajez lucrarea ca fișier în loc de link?

Da. Când un link nu poate duce tot (fotografiile tale, texte lungi), dialogul Share spune exact ce s-ar pierde și oferă în schimb un fișier **.lolly**: un singur fișier care conține designul, imaginile pe care le folosește și, dacă vrei, instrumentul în sine. Tu decizi cât călătorește - numele și datele tale intră doar dacă profilul tău își dă acordul, arta licențiată este reținută dacă nu o incluzi tu, iar cine deschide un fișier care poartă un instrument este întrebat dacă are încredere în el înainte ca acesta să poată rula. Vezi [Partajarea lucrărilor tale](/info/using.html#sharing-your-work).

## Pot două persoane să lucreze la același design fără internet?

Da. O persoană trimite o invitație (un link, un cod QR sau un cod scurt), cealaltă o acceptă și ambele dispozitive țin aceeași sesiune live - prezență, inele de focalizare și tot restul. Funcționează în orice rețea comună, inclusiv pe un hotspot de telefon dintr-o pivniță, pentru că nu există niciun server la mijloc. Vezi [Lucrul împreună](/info/collaborate.html).

## Unde au dispărut instrumentele cu brand SUSE?

Se află deja într-un depozit separat, privat. O clonă publică nu descarcă deloc pachetul de brand SUSE, așa că un build public rulează profilul neutru `lolly-start` - instrumentele comunitare, independente de brand, plus un brand gol pe care îl completezi cu al tău. SUSE își operează propria instanță pentru a-și proteja mărcile înregistrate.

## De ce este gratuit? Unde e șmecheria?

**Am construit Lolly pentru noi.** SUSE avea nevoie de mii de fișiere conforme cu brandul, fiecare cu numele sigilat înăuntru, făcute fără a preda nimic unor servicii externe. Așa că am construit un instrument care face totul pe dispozitiv și l-am lansat ca open source, ca tot ce facem. Îl întreținem în continuare pentru că îl folosim zilnic. **Nu există nicio obligație:** tot ce e aici funcționează cu sau fără noi.

Linia aceasta este trasată în licență, nu într-o promisiune: tot ce rulează local este gratuit, pentru totdeauna. O versiune care a fost lansată este licențiată astfel încât nu poate fi retrasă și nu există niciun acord de contribuitor care să poată relicenția munca cuiva. Vezi [poziționarea](/info/positioning.html) pentru declarația completă.

## Cât păstrează SUSE privat? (adică, când se trage covorul de sub picioare)

Motorul, shell-urile, schemele și instrumentele independente de brand sunt open source; mărcile înregistrate SUSE și instrumentele cu brand sunt partea care rămâne privată și sunt deja separate. Instanța publică de la [lolly.tools](https://lolly.tools) rulează pe brandul neutru.

Granița este structurală, nu promisă. Fiecare versiune lansată este open source și nu poate fi retrasă, nu există niciun acord de contribuitor care să poată relicenția munca cuiva, iar singurul lucru păstrat deoparte este marca înregistrată. Când o altă companie și-a închis sursele Linux pentru întreprinderi în 2023, SUSE a cofondat [OpenELA](https://openela.org) pentru a menține acel cod deschis - aceeași poziție pe care o moștenește acest proiect.

Transparență totală: SUSE *chiar* dezvoltă instrumente interne pentru a integra Lolly în sistemele sale IT - asta ține de configurarea internă a SUSE, nu de dezvoltare publică vs. privată. Lolly își propune de asemenea să fie construit prin [Open Build Service](https://openbuildservice.org/), cu artefacte securizate de lanț de aprovizionare livrate de [SUSE Application Collection](https://apps.rancher.io/applications).

## Ce aromă are logoul Lolly?

Unii spun Lime, alții Mentă și uneori Măr; Lolly aduce dulceața, tu creezi aroma!
