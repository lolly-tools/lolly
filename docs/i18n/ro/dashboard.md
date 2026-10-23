# Settings

Settings este locul unde schimbi cum funcționează Lolly pentru tine: detaliile tale, sistemul de design pe care îl folosești, accesibilitatea, ce este stocat pe acest dispozitiv și ce este pregătit offline. Deschide-l cu **Settings** din bara de la baza ecranului principal sau din meniul avatarului. Se deschide pe **Preferences**, cu alte patru file alături.

| Filă | Adresă | Ce conține |
|---|---|---|
| **Preferences** | `#/settings` | Detaliile tale, sistemele de design, aspectul, emoji, accesibilitatea, conexiunile, stocarea și descărcările offline |
| **This device** | `#/settings?tab=device` | O citire live a acestui browser și a acestei mașini, plus sunet și o vedere doar pentru citire a stocării |
| **Design system** | `#/settings?tab=brand` | Sistemul de design activ ca o copertă și pagini, cu o bandă de coperte pentru a comuta sistemele |
| **Capabilities** | `#/settings?tab=caps` | Tot ce poate face Lolly, ca carduri căutabile |
| **Activity & stats** | `#/settings?tab=activity` | Catalogul, contoarele tale locale și munca recentă |

Fiecare filă are propria adresă, iar vechile linkuri `#/profile` și `#/d` se deschid în continuare în locul potrivit, până la setări individuale.

## Preferences

Preferences este o pagină lungă cu o **bară de setări** pe margine și un câmp **Search settings** deasupra barei care o filtrează pe măsură ce tastezi. Fiecare secțiune se deschide direct dintr-un link de forma `#/settings?focus=<section-id>`, de exemplu `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - numele, datele de contact și fotografia ta, plus comutatorul **Use my details to create**. [Profiluri](/info/profile.html) explică cum le folosesc instrumentele.
- <!--i:seal--> **Content Credentials** - identitatea verificată opțională care îți semnează exporturile. Vezi [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - comută, adaugă, ascunde sau elimină sisteme de design. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) acoperă fiecare acțiune.
- <!--i:moon--> **Appearance** - tema (Light, Dark sau Brand, care pictează aplicația în paleta ta) și **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - setul din care sunt desenate emoji când începi ceva nou, cu licența artei lui și cât de puternic îți recolorează paleta (**Off**, **Subtle**, **Strong**, **Full**, **Mono** sau **Duotone**). **Keep skin tones and flags** le lasă în propriile culori. Munca deja făcută păstrează setul cu care a fost făcută.
- <!--i:eyeoff--> **Accessibility** - patru comutatoare de confort, plus Sound și Neurospicy Mode. Vezi [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - spațiu de stocare pe care îl conectezi, precum Dropbox, Google Drive, OneDrive, Nextcloud sau S3, și **Sync across devices**. Vezi [Sincronizează-ți dispozitivele](/info/sync.html).
- <!--i:globe--> **Trusted sites** - site-urile pe care o casetă web Design sau un demo Sandbox le poate contacta fără să întrebe și, unde serverul o oferă, **Allow pages from any site**. [Politica de confidențialitate](/info/privacy.html) listează ce trimite fiecare cerere.
- <!--i:download--> **Your renders** - **Save my renders to my library** păstrează în Assets o copie a fiecărei imagini, clip audio și video pe care o descarci, sub o etichetă Renders.
- <!--i:database--> **Storage** - ce păstrează Lolly pe acest dispozitiv și butoanele care șterg sau transportă datele tale. Vezi [Storage](#storage).
- <!--i:cpu--> **Available offline** - descarcă ce ai nevoie înainte să pierzi conexiunea. Vezi [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - în aplicația desktop, urmărește un dosar și preia în Lolly tot ce este plasat în el, prin același selector pe care îl primește un drag-and-drop.
- <!--i:clock--> **Your activity** - ce ai făcut pe acest dispozitiv, numărat local.
- <!--i:sliders--> **Feature flags** - pornește sau oprește părți ale aplicației, precum **Print preflight** sau **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - de unde își ia această instalare instrumentele și catalogul. Vezi [Lolly instance](#lolly-instance).

Cardurile de temă sunt previzualizări live și se aplică în clipa în care alegi una, doar pe acest dispozitiv.

![Trei carduri de temă, fiecare previzualizând propriul tip și propria culoare, cu cel activ marcat](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibility

**Settings → Preferences → Accessibility** conține patru setări de confort pentru aplicația din jurul muncii tale. Fiecare este oprită până o pornești, iar niciuna nu ajunge în interiorul canvasului unui instrument sau al unui export, deci o aplicație mai calmă nu mută niciodată un pixel din fișierul pe care îl livrezi.

- <!--i:pause--> **Reduce motion** oprește tranzițiile, glisările și înfloriturile aplicației. Canvasul tău și orice export animat continuă să se miște așa cum a fost proiectat.
- <!--i:photos--> **Hide colourful previews** înlocuiește grafica de previzualizare a galeriei cu carduri calme de pictogramă și text și atenuează miniaturile proiectelor, ca să rămână recognoscibile fără să strige.
- <!--i:sliders--> **High contrast** întărește marginile, textul și inelele de focus ale aplicației. Culorile brandului și canvasul rămân așa cum le-ai setat.
- <!--i:font--> **Large text** mărește etichetele, meniurile și textul butoanelor aplicației. Tipografia din designurile tale nu este atinsă, deci nimic din ce exporți nu se reașază.

Aceste setări trăiesc în profilul tău, deci călătoresc într-un export de profil și sosesc la următoarea instalare cu numele și sesiunile tale. O mică copie doar pe dispozitiv le aplică înainte de prima desenare.

Același card conține **Sound**, un strat blând de sunete de asistență pentru ce faci (sosirea în galerie, un rezultat Content Credentials, închiderea unui panou), și **Neurospicy Mode**, o piesă calmă de concentrare. Pornirea Neurospicy deschide un mic player în colț care te urmează prin aplicație. Acolo alegi o piesă, sari, setezi volumul și minimizezi sau închizi playerul. Piesele includ melodii procedurale *Lolly Sings*, bucle ambientale și beaturi, audio propriu și stații de radio pe internet, care necesită conexiune. Ambele sunt oprite implicit și sunt reținute, iar oprirea Sound reduce la tăcere și piesa de concentrare. Meniul profilului și **This device** poartă același comutator.

Interfața poate fi navigată de la tastatură, controalele personalizate poartă etichete pentru cititoare de ecran, iar previzualizarea live a fiecărui instrument este expusă ca o singură imagine etichetată care descrie ce arată.

### Storage

Indicatorul de stocare contabilizează fiecare octet pe care îl ține această instalare, categorie cu categorie, față de ce raportează browserul.

![Indicatorul de stocare, defalcând sesiunile salvate, imaginile și cache-ul față de ce raportează de fapt browserul](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Sub indicator:

- **Move to another device** are **Export my data**, **Import data…** și **Export my data & render everything**. [Mută-ți munca pe alt dispozitiv](/info/find-your-work.html#move-your-work-to-another-device) le parcurge.
- **Clear cache** elimină fișierele de catalog descărcate, care se descarcă din nou când e nevoie.
- **Remove automatic checkpoints older than 30 days** eliberează spațiu din History și păstrează versiunile salvate și cele cu nume.
- **Clear all my data** elimină tot ce păstrează Lolly în acest browser, după ce tastezi un cuvânt de confirmare. [Dacă ștergi datele browserului](/info/find-your-work.html#if-you-clear-your-browser-data) listează ce dispare.

### Available offline

Lolly pune în cache ecranele pe măsură ce le vizitezi, ceea ce acoperă doar locurile unde ai fost deja. **Available offline** este pentru drumul pe care îl vezi venind: descarcă părțile de care vei avea nevoie și urmărește o bară de progres, iar tot ce ai luat continuă să funcționeze fără conexiune.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (fiecare vedere, editor și font, inclusiv ecrane pe care nu le-ai deschis niciodată), **Catalogue** (tot, sau **Choose by tag**) și **Guides & docs** (această documentație în limba ta, cu capturi de ecran cu tot).
- <!--i:cpu--> **AI models** - fiecare model local pe propriul rând, cu dimensiunea lui: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector și Singing voices. Un model de peste 50 MB este marcat **large download**.
- <!--i:wrench--> **Tools** - fiecare instrument se descarcă separat sau **Download all** ia toate instrumentele. O bifă înseamnă gata offline.

**Download everything** de sus ia aplicația, domeniul de catalog ales, ghidurile și toate instrumentele. Bifează **Include all the AI models** ca să adaugi modelele sau descarcă un model de pe propriul rând; vocile de cântat se descarcă doar de pe propriul rând. Politica unei organizații poate opri descărcările AI, iar rândurile îți spun atunci.

Descărcările reiau de unde au rămas dacă anulezi sau pierzi conexiunea și se reîmprospătează singure când ești din nou online, preluând doar ce a schimbat o versiune. Dacă browserul nu a acordat stocare persistentă, **Protect downloads** o cere: diferența dintre „descărcat” și „descărcat până când browserul vrea spațiul înapoi”.

### Lolly instance

**Lolly instance** spune de unde își ia această instalare instrumentele și catalogul: adresa unei instanțe sau *Bundled with this app* când totul vine în build.

- **Design-system source** arată de unde vine sistemul de design furnizat.
- **Instance console** deschide paginile de administrare ale unei instalări, unde le oferă.
- **Change** îndreaptă aplicația desktop spre altă instanță. Un browser nu poate încărca instrumente și resurse între origini, deci pe web secțiunea oferă în schimb **Open a workspace**.
- **Leave** elimină sistemul de design, instrumentele și catalogul instanței, iar munca ta rămâne. Vezi [Folosește Lolly în organizația ta](/info/organisation.html#leaving).
- Când ești autentificat într-o organizație, **Sign out** încheie această sesiune, iar **Sign out everywhere** încheie sesiunile tale pe fiecare dispozitiv, inclusiv acesta.

## This device

- <!--i:monitor--> **This Machine** - ecran, intrare, grafică, memorie, codecuri, backend de stocare și altele, citite live din această sesiune. Nimic nu este stocat și nimic nu este trimis. Se deschide singur pe un ecran lat, unde fila se așază pe două coloane.
- <!--i:neurobeat--> **Sound** - sunetele interfeței și buclele de concentrare Neurospicy, singurul comutator din această filă care scrie ceva.
- <!--i:database--> **Storage** - o vedere doar pentru citire a indicatorului din [Preferences](#storage), unde îți ștergi sau îți transporți datele.

## Design system

Sistemul de design activ, așezat pentru citire. Când acest browser conține două sau mai multe sisteme de design, o bandă de coperte mici sus le listează: alege una ca s-o activezi, iar **Undo** din notificarea care urmează o pune înapoi pe cea anterioară.

![Fila Design system pe Lolly Demo: o bandă de coperte pentru comutarea sistemelor, apoi coperta cu logoul, numele, nota și numerele care deschid fiecare pagină](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Fila se deschide pe o copertă pictată în culorile proprii ale sistemului, cu logoul lui, numele în fontul de afișare și nota scrisă de autorul lui. O linie de numere de pe copertă trimite la fiecare pagină:

- <!--i:palette--> **Colour** - suprafața, textul, primara și secundara aspectelor deschis și închis, fiecare culoare cu nume ca un chip cu numele și hex-ul ei, o bandă pentru fiecare rampă de nuanțe și spectrul diagramelor, iar rolurile de culoare într-un pliu. Selectează o valoare ca să copiezi hex-ul.
- <!--i:font--> **Type** - Headings, Text, Emphasis și Code, fiecare în propriul font.
- <!--i:photos--> **Logos** - fiecare fișier de logo pe fundalul pentru care a fost făcut.
- <!--i:layers--> **Colourways** - perechea deschis și închis a fiecărui colourway, când sistemul are mai mult de unul.
- <!--i:sliders--> **Tokens** - rază, spațiere, efecte și gradienți.
- <!--i:document--> **Print & CMYK** - culorile blocate pe o cerneală exactă și condițiile de presă pe care le poate declara un PDF CMYK.

Comutarea este singura schimbare pe care o face această filă. Editezi un sistem de design în [Design System Setup](/info/brand-studio.html) la `#/start`, către care trimite coperta. Un sistem doar pentru citire spune asta pe copertă; sistemele locale pe care le creezi rămân editabile. `/b` și `/brand` sunt scurtături direct la această filă.

## Capabilități

Fiecare parte a platformei este descrisă ca un card, în douăsprezece grupuri: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control și Architecture (for builders). Fiecare grup se pliază și arată numărul de carduri. Un card se deschide într-un dialog cu funcțiile acelei capabilități și, pentru aproximativ jumătate dintre ele, captura de ecran pe care o folosește această documentație.

Câmpul de căutare de deasupra grupurilor filtrează cardurile pe măsură ce tastezi și deschide grupurile care mai conțin o potrivire. Spune câte capabilități caută, iar o interogare fără potrivire spune asta în cuvinte.

Această filă este documentație scrisă despre ce poate face Lolly, ținută în pas cu aceste ghiduri. Nu sondează mașina pe care ești; **This device** face asta.

## Activity & stats

Mai întâi build-ul: câte instrumente sunt încărcate, câte formate de export există, pe câte suprafețe rulează platforma și câte resurse de brand poartă catalogul, cu un panou **Catalogue** care detaliază ce livrează acest build.

Apoi partea ta: **Your activity** numără ce ai făcut pe acest dispozitiv, iar **Recent creations** și **Latest exports** sunt stive prin care poți glisa, fiecare apărând când există ceva de arătat. Ambele deschid un element așa cum a fost. Aceste contoare rămân pe dispozitiv; o instanță Lolly Work opțională își ține propria [telemetrie a organizației și propriile înregistrări de audit](/info/privacy.html#organisation-services-with-lolly-work).

## Linkuri directe

Fiecare filă și secțiune din Settings are propriul link, pe care îl poți pune la favorite sau lipi. [Căutarea](/info/search.html) își îndreaptă rezultatele **Settings** către același registru din care se randează Settings, deci o secțiune nu poate fi redenumită pe sub un rezultat de căutare.

::: details Fiecare formă de link

- **O filă:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **O secțiune Preferences:** `#/settings?focus=<section-id>`, precum `#/settings?focus=offline-section`.
- **O secțiune, exact:** id-ul ei ca indicator simplu, precum `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` sau `#/settings?cap-formats`. Vechile linkuri `#/settings?dash-lock` și `#/settings?dash-palette-wheel` deschid coperta și pagina Colour.
- **O secțiune după cuvânt-cheie:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (pagina Colour) sau `#/settings?tokens`. Cuvintele-cheie pot fi partajate: `print` aparține atât referinței de tipar din fila brand, cât și grupului Print production, iar primul în ordinea paginii câștigă. Folosește id-ul când contează care.

Un link direct comută la fila care deține ținta, deschide orice grup în care este pliată, apoi derulează la ea, așteptând o clipă cât secțiunile de deasupra își termină așezarea. Adresele retrase `#/platform` și `#/capabilities` se contopesc în Settings cu indicatorii lor de link direct intacți.
:::

---

**Related:** [Profiluri](/info/profile.html) pentru detaliile tale și contextele în care creezi. [Design System Setup](/info/brand-studio.html) pentru editarea a ce arată fila Design system. [Găsește și recuperează-ți munca](/info/find-your-work.html) pentru stocare, copii de siguranță și mutarea pe alte dispozitive.
