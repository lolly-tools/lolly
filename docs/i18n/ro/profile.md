# Profiluri - cine ești când creezi

Un **profil** este identitatea de lucru sub care creează Lolly. Este micul set de detalii din care un instrument poate extrage, ca să nu le retastezi de fiecare dată - numele tău, datele de contact, o fotografie de profil opțională, câteva preferințe - plus tot ce acumulezi în timp ce lucrezi: sesiuni salvate, imagini încărcate și contorul local de activitate.

Tot ce ține de un profil trăiește **pe dispozitiv**, în baza de date locală a browser-ului (IndexedDB pe web PWA, sistemul de fișiere pe aplicațiile Tauri). Nu există cont și nimic nu este încărcat. Îl gestionezi sub **Profile** (dreapta sus în galerie); instrumentele doar îl *citesc*, și doar câmpurile specifice pentru care au fost construite să le precompleteze.

> Un profil se referă la *tine* (sau la oricine creează aici). Este distinct de **Platform** - culorile, fonturile și setările globale ale brandului - și de **Capabilities**, catalogul a ceea ce poate face aplicația. Vezi [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) la final.

## Ce conține un profil

| Parte | Ce este |
|---|---|
| **Nume** | Prenume și nume de familie. |
| **Contact** | Email și telefon. |
| **Locație** | Oraș și țară. |
| **Fotografie de profil** | O fotografie opțională, decupată pătrat și păstrată ca imagine locală. Folosită de instrumente precum semnăturile de email, cardurile cu citate, organigramele și layout-urile dinamice. |
| **Use my details to create** | Un singur comutator opt-in (afișează **Using my details** odată activat). Controlează dacă detaliile tale personale sunt incluse ca **proveniență** - linia de autor/credit încorporată în fișierele exportate - și ca autor la rulările în lot **/pro**. (Nu condiționează pre-completarea: vezi [How tools use your profile](#how-tools-use-your-profile).) |
| **Preferințe** | Tema ta (Light, Dark sau Brand - tema de brand colorează aplicația în propria ta paletă) și ce părți ale aplicației ai activat prin **Feature flags**. |
| **Accesibilitate** | Patru comutatoare de confort - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - păstrate în înregistrarea profilului, deci sunt incluse la exportul unui profil. Vezi [Accessibility](#accessibility). |
| **Munca ta** | Sesiuni salvate (cu miniaturi) - organizate în foldere imbricate în **[Projects](/info/using.html)** - biblioteca ta **My images** și statisticile locale de activitate, toate asociate acestui profil. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Ecranul Profile - nume, contact, o fotografie de profil opțională și preferințele tale](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Nimic din toate acestea nu este obligatoriu. Un profil gol este un profil perfect valid; completezi doar ce îți economisește tastarea.

Pagina este lungă, așa că are propriul **rail de setări** pe lateral - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - cu un câmp **Search settings** deasupra lui, care filtrează lista pe măsură ce tastezi. Fiecare secțiune poate fi accesată direct printr-un link de forma `#/profile?focus=<section-id>`, care o deschide și o derulează în vizor (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, și așa mai departe), astfel încât un link poate indica o singură setare, nu doar începutul paginii.

![Trei carduri de temă, fiecare previzualizând propriul tip și propria culoare, cu cel activ marcat](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Un profil este un context, nu doar o persoană

Cuvântul „profil" sugerează o singură persoană fixă, dar în Lolly este de fapt un **context de creație** - *cine ești cât timp creezi acest lucru*. Acel context poate lua trei forme diferite, iar Lolly le tratează pe toate la fel.

### Ca individ

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Controlul pentru fotografia de profil, gol până încarci o fotografie care apoi rămâne pe acest dispozitiv](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Ca echipă

Un profil nu trebuie neapărat să fie o singură persoană. Poate reprezenta o **echipă sau o funcție dintr-o organizație**: numele comun al echipei, o adresă de inbox de grup (`events@…`), un departament, fotografia echipei sau semnul unității. O persoană îl configurează, îl exportă (vezi mai jos), iar restul echipei încarcă același profil - astfel încât tot ce produce echipa poartă detalii consistente, fără ca nimeni să le reintroducă. Un chioșc partajat sau un laptop demo predat poate rula un singur profil de echipă sub care creează toată lumea din spatele lui.

### Ca funcție - un rol pe care îl porți uneori

Acesta este cazul pe care modelul rigid „o persoană, un profil" îl ratează. Ai putea fi **manager de eveniment trei zile pe an** și cu totul altceva restul timpului. În acele trei zile vrei detaliile evenimentului, inboxul evenimentului, poate un sub-brand de eveniment care să-ți completeze ecusoanele și semnalistica; celelalte 362 vrei identitatea ta normală înapoi.

În Lolly, acel rol este pur și simplu **un alt profil pe care îl păstrezi la îndemână** - un pachet salvat (secțiunea următoare) pe care îl încarci pentru eveniment și îl pui deoparte după. Rolul este o pălărie, nu un cont nou. Pune-l când ai nevoie, scoate-l când ai terminat.

## O instalare, un profil activ - poți păstra multe

În orice moment, o instalare are **un singur profil activ** - detaliile pe care le vede un instrument chiar acum. Nu există un comutator de profiluri în aplicație; în schimb, fiecare profil este un **pachet portabil** (un singur `.zip`, vezi [mai jos](#moving-a-profile-to-a-new-device)). Acesta este, în mod deliberat, același mecanism ca mutarea pe un dispozitiv nou - un profil este un fișier pe care îl poți salva, copia și încărca.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Comutarea cea mai curată:** **Profile → Storage → Clear all my data**, apoi **Import** pachetul pentru contextul în care intri. Acum creezi exclusiv sub acel profil.
- <!--i:layers--> **Suprapunere:** importul *fără* a curăța mai întâi **suprapune** - profilul, sesiunile și imaginile importate se așază peste ce există deja, înlocuind orice are același nume și lăsând restul neatins. Util pentru a prelua sesiunile salvate ale unei echipe în propria configurație; nu ce vrei dacă ai nevoie de o delimitare clară de rol.
- <!--i:monitor--> **Unul lângă altul:** pentru că totul este limitat la nivel de dispozitiv, un profil de browser separat, un cont de utilizator separat sau o a doua instalare PWA poartă fiecare propriul profil Lolly independent. Rulează simultan instalarea ta personală și instalarea de chioșc pentru eveniment, fără să comuți.

Deci dacă chiar jonglezi cu mai multe contexte (tu, echipa ta, pălăria de manager de eveniment), păstrezi mai multe pachete și încarci pe cel de care ai nevoie:

![Contorul de stocare, care detaliază sesiunile salvate, imaginile și cache-ul în raport cu ce raportează efectiv browserul](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Păstrează un pachet per context și redenumește fișierele după ce reprezintă (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Fișierul *este* profilul.

## Accesibilitate

**Profile → Accessibility** conține patru setări de confort pentru aplicația *din jurul* muncii tale. Fiecare este dezactivată până o activezi, și niciuna nu ajunge în interiorul canvasului unui instrument sau al unui export - o aplicație mai calmă nu trebuie să mute niciun pixel din fișierul pe care îl livrezi.

- <!--i:film--> **Reduce motion** - dezactivează tranzițiile, glisările și înfloriturile animate din aplicație. Canvasul instrumentului tău și orice export animat continuă să se miște exact așa cum au fost concepute.
- <!--i:image--> **Hide colourful previews** - înlocuiește ilustrațiile de previzualizare din galerie cu carduri calme, cu pictogramă și text, și reduce culoarea și contrastul miniaturilor proiectelor tale, astfel încât rămân recognoscibile fără să „strige”. În interiorul unui instrument, totul se afișează în culori complete.
- <!--i:sliders--> **High contrast** - întărește marginile, textul și inelele de focalizare ale aplicației. Culorile brandului tău și tot ce se află pe canvas rămân exact așa cum le-ai stabilit.
- <!--i:font--> **Large text** - mărește tipul de literă al aplicației: etichete, meniuri și text de buton. Controalele își păstrează dimensiunea, deci doar cuvintele din interiorul lor devin mai mari, iar tipul de literă din designurile tale rămâne neatins, deci nimic din ce exporți nu se rearanjează.

Acestea sunt stocate chiar în înregistrarea profilului, motiv pentru care sunt incluse la exportul unui profil și ajung pe următoarea instalare alături de numele tău și de sesiunile tale. (Dispozitivul mai păstrează și o mică oglindă locală, astfel încât setarea se aplică înainte de primul randaj; acea oglindă este exclusiv locală și nu călătorește.)

## Instanța ta Lolly

**Profile → Lolly instance** arată de unde își ia această instalare instrumentele și catalogul - adresa instanței, sau *Bundled with this app* când totul este livrat în interiorul build-ului. Acolo unde o implementare oferă unul, un link **Instance console** deschide suprafața sa de administrare, iar **Change** / **Disconnect** repoziționează instalarea sau o desprind.

Repoziționarea către o altă instanță necesită **aplicația desktop**: un browser blochează o pagină să încarce instrumente și active din alte origini, deci pe web secțiunea raportează unde te afli și se oprește acolo.

## Disponibil offline

Lolly pune în cache pe măsură ce înaintezi, dar acest cache progresiv acoperă doar locurile prin care ai trecut deja. **Profile → Available offline** este pentru călătoria pe care o vezi venind: o oră pe wifi de aeroport înainte de un zbor fără conexiune. Descarcă părțile de care vei avea nevoie, urmărește o singură bară de progres, iar tot ce ai luat continuă să funcționeze odată dispărută conexiunea.

Șapte părți, fiecare cu dimensiunea afișată înainte să te angajezi:

- <!--i:layout--> **Aplicația** - fiecare vizualizare, editor și font, inclusiv cele pe care nu le-ai deschis încă. Fără aceasta, un ecran pe care nu l-ai vizitat niciodată online nu se poate încărca offline.
- <!--i:image--> **Catalog** - active de brand dincolo de cele esențiale. Ia-le pe toate, sau deschide *Choose by tag* și ia doar etichetele pe care le folosești.
- <!--i:book--> **Ghiduri și documentație** - acest site de documentație, în limba ta, inclusiv capturile de ecran.
- <!--i:cpu--> **Voci de sinteză vocală** - modelele de voce din spatele audio-ului Script și al narațiunii. Descărcate o singură dată, apoi rulează pe dispozitiv.
- <!--i:zap--> **Modele de upscaling** - upscalerele AI pentru imagini: foto, ilustrație/anime și față.
- <!--i:layers--> **Eliminarea fundalului** - modelele de decupaj pe dispozitiv din spatele funcției *Remove background*.
- <!--i:shield--> **Scanare profundă Verify** - scanerul de filigrane pe dispozitiv, pentru verificarea Content Credentials fără conexiune.

Ultimele patru sunt marcate **descărcare mare** și sunt în mod deliberat opțiuni individuale: **Download everything** din partea de sus preia aplicația, sfera catalogului pe care ai ales-o, documentația și toate uneltele într-o singură trecere și nimic altceva. Vocile de sinteză, upscalerele, eliminarea fundalului și scanarea profundă se descarcă fiecare doar când ceri acel rând pe nume - câteva sute de megaocteți ascunse într-un singur buton ar fi necinstit.

Sub piese se află lista pe unelte: fiecare unealtă se descarcă individual (bifa înseamnă gata pentru offline), sau **Download all** le ia pe toate deodată. Descărcările pot fi reluate - anulezi sau pierzi conexiunea și rularea următoare continuă de unde s-a oprit, preluând doar ce lipsește - și se reîmprospătează singure când ești din nou online, preluând doar ce a schimbat o versiune nouă.

Dacă browserul nu a acordat stocare persistentă, secțiunea spune asta și oferă **Protect downloads**, care o solicită - diferența dintre "descărcat" și "descărcat până când browserul vrea spațiul înapoi".

## Mutarea unui profil pe un dispozitiv nou

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Pentru că un profil este în întregime local, singura modalitate de a-l aduce pe o instalare goală - un laptop nou, un browser resetat, mașina unui coleg, o cutie offline - este să **cari fișierul**. Niciun login nu îl restaurează pentru tine, și asta e ideea: nu a părăsit niciodată dispozitivul tău, de la bun început.

- <!--i:download--> **Export my data** descarcă un fișier `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - numit după profilul căruia îi aparține, cu un număr de secvență zilnic pentru ca exporturile repetate să nu se suprapună (părțile numelui lipsesc dacă profilul nu le are). Conține profilul tău, fiecare sesiune salvată (cu miniatura ei), imaginile încărcate de tine - tokenii tăi de brand și fonturile instalate călătoresc alături ca active de utilizator - și preferințele tale (temă, aspect, statistici locale de activitate).
- <!--i:upload--> **Import data…** pe cealaltă instalare citește acel fișier înapoi și continui exact de unde ai rămas.
- <!--i:box--> **Export my data & render everything** scrie aceeași copie de rezervă *plus* un al doilea zip care randează fiecare sesiune salvată în fișierul ei final, în foldere care oglindesc Proiectele tale. O arhivă offline completă a surselor și a rezultatelor - poate fi mare și lentă cu multe sesiuni.

![Cele două butoane care mută o instalare întreagă: Export my data scrie un zip, Import data îl citește înapoi](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Pachetul este un zip simplu, autonom, deci călătorește prin **orice** mijloc - USB, AirDrop, un partaj de rețea, email către tine însuți - iar ținta poate fi complet offline. Fiecare parte are checksum, deci un fișier deteriorat în tranzit este detectat la import, în loc să fie restaurat pe jumătate stricat. Importul **fuzionează** (profilul/sesiunea/imaginea cu același nume este suprascrisă; tot restul este păstrat), deci nu șterge niciodată o țintă deja în uz.

Ce nu călătorește: cache-ul de catalog (se re-descarcă singur pe noul dispozitiv) și instrumentele în sine (se presupune că sunt deja prezente).

Pentru structura exactă a pachetului, politica de versiuni și regulile de integritate, vezi **[Data Transfer](/info/data-transfer.html)**; pentru parcursul complet, **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## Cum folosesc instrumentele profilul tău

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Un instrument doar *precompletează* câmpurile de profil pentru care a fost construit explicit să se lege:

**Opțiunea (proveniență).** Când exporți un asset, datele tale călătoresc opțional alături ca **proveniență** - o linie de autor/credit inclusă în metadatele fișierului (PNG, PDF, SVG, …) - astfel încât un asset finalizat poate spune cine l-a creat. *Asta* guvernează **Use my details to create**: lasă-l dezactivat și exportul tot poartă atribuția unealtă/platformă "Made with Lolly", dar nicio linie personală de autor/contact nu este inclusă. (Aceeași opțiune setează autorul și pe rulările batch **/pro**.) (Autori de unelte: vezi [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) și [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Singurul comutator Use my details to create, lângă Save Profile și dezactivat până îl pornești](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil vs. Platformă vs. Capabilități

Trei lucruri stau aproape unul de altul în interfață și se confundă ușor:

- <!--i:people--> **Profile** - *tu* (sau echipa ta, sau rolul pe care îl ai): nume, contact, fotografie, munca ta salvată. Personal, local pe dispozitiv, portabil ca pachet.
- <!--i:palette--> **Platform** - *brandul*: culori, fonturi și setări globale față de care randează fiecare unealtă. Partajat și consistent, nu personal.
- <!--i:sliders--> **Capabilities** - *ce poate face aplicația*: setul complet de funcții și uneltele disponibile pentru tine.

Un profil schimbă de la *cine* provine o resursă; platforma schimbă *cum arată*; capabilitățile sunt *ce poți crea*.

### „Profil" mai înseamnă alte două lucruri în altă parte - nu pe acesta

Cuvântul are mai multe sensuri diferite în tot proiectul. Niciunul dintre acestea nu este profilul personal despre care vorbește această pagină:

- <!--i:box--> **Content profile** - o configurație la momentul compilării în `profiles.json` care leagă un set de pachete de unelte de un catalog de brand (de ex. `suse`, `lolly-start`). Este ceea ce alege un operator la desfășurare, și este ceea ce selectează și **parametrul URL/CLI** `profile` - o variantă de *culoare* la export (condiția de tipar ICC/CMYK - vezi [URL Mode](/info/url-mode.html)). Ambele privesc *compilarea/rezultatul*, nu pe *tine*. Vezi [Configuration](/info/configuration.html).
- <!--i:seal--> **Identity profile** - **identitatea Content Credentials verificată** opțională pe care o poți înregistra (un certificat pe termen scurt care leagă emailul tău de exporturile tale semnate). Aceasta este o identitate de semnare, separată de câmpurile nume/contact ale profilului personal, deși **Use my details to create** guvernează dacă oricare dintre ele este inclus. Vezi [Content Credentials Identity](/info/content-credentials-identity.html).

![Cardul Verified identity, lățime de telefon: selectorul duratei certificatului și pasul de înregistrare de sub el - profilul de identitate, separat de datele tale personale](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Confidențialitate

În afara înregistrării opționale de identitate de mai sus (care trimite emailul cu care te înregistrezi către serviciul de certificate - vezi [Server Surface](/info/server-surface.html)), un profil nu este niciodată transmis, încărcat sau folosit pentru a te identifica sau urmări - nu e nimic la care să consimți, doar această notificare ca să știi ce se păstrează. Șterge totul oricând cu **Profile → Clear all my data**. Vezi [Privacy Policy](/info/privacy.html).
