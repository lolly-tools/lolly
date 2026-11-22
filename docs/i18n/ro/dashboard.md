# Setări

Settings conține datele tale, sistemul tău de design, accesibilitatea, stocarea pe acest dispozitiv și descărcările offline. Deschide **Settings** din bara de la baza ecranului principal sau din meniul avatarului tău și se deschide la **Preferences**.

| Filă | Adresă | Ce conține |
|---|---|---|
| **Preferences** | `#/settings` | Datele tale, sistemele de design, aspectul, emoji, accesibilitatea, conexiunile, stocarea și descărcările offline |
| **This device** | `#/settings?tab=device` | Informații în timp real despre acest browser și acest dispozitiv, plus sunet și o vizualizare a stocării doar pentru citire |
| **Design system** | `#/settings?tab=brand` | Sistemul de design activ ca o copertă și pagini, cu o bandă de coperte pentru a schimba sistemele |
| **Capabilities** | `#/settings?tab=caps` | Tot ce poate face Lolly, sub formă de carduri în care poți căuta |
| **Activity & stats** | `#/settings?tab=activity` | Catalogul, contoarele tale locale și munca recentă |

Linkurile vechi `#/profile` și `#/d` deschid în continuare locul potrivit, până la setările individuale.

<!--i:eti-sliders-->
## Preferințe

Preferences este o pagină lungă cu o **bară laterală de setări**. Câmpul **Search settings** de deasupra barei o filtrează pe măsură ce tastezi. Fiecare secțiune are un link de forma `#/settings?focus=<section-id>`, precum `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - numele, datele de contact și fotografia ta portret și comutatorul **Use my details to create**. [Profiluri](/info/profile.html) explică modul în care instrumentele le folosesc.
- <!--i:seal--> **Content Credentials** - identitatea verificată opțională care îți semnează exporturile. Vezi [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - schimbă, adaugă, ascunde sau elimină sisteme de design. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) descrie fiecare acțiune.
- <!--i:moon--> **Appearance** - tema (Light, Dark sau Brand, care colorează aplicația în paleta ta), **Your colourway** când sistemul de design oferă mai mult de unul ([Personalizează un colourway](/info/colourways.html#make-a-colourway-your-own)) și **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - setul de emoji pentru munca nouă, cu licența elementelor grafice, și intensitatea cu care paleta ta recolorează emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** sau **Duotone**). **Keep skin tones and flags** le păstrează culorile proprii. Munca deja creată își păstrează setul.
- <!--i:eyeoff--> **Accessibility** - patru comutatoare de confort, plus Sound și Neurospicy Mode. Vezi [Accesibilitate](#accessibility).
- <!--i:link--> **Connected services** - spațiul de stocare pe care îl conectezi, precum Dropbox, Google Drive, OneDrive, Nextcloud sau S3, și **Sync across devices**. Vezi [Sincronizează-ți dispozitivele](/info/sync.html).
- <!--i:globe--> **Trusted sites** - site-urile pe care o casetă de pagină web din Lolly Design sau un demo Lolly Sandbox le poate contacta fără să întrebe și, acolo unde serverul oferă opțiunea, **Allow pages from any site**. [Politica de confidențialitate](/info/privacy.html) listează ce trimite fiecare cerere.
- <!--i:download--> **Your renders** - **Save my renders to my library** păstrează în Assets, sub o etichetă Renders, o copie a fiecărei imagini, fiecărui clip audio și fiecărui videoclip pe care îl descarci.
- <!--i:database--> **Storage** - ce păstrează Lolly pe acest dispozitiv și butoanele care șterg sau transferă datele tale. Vezi [Stocare](#storage).
- <!--i:cpu--> **Available offline** - descarcă ce îți trebuie înainte să pierzi conexiunea. Vezi [Disponibil offline](#available-offline).
- <!--i:folder--> **Hot folder** - în aplicația desktop, Lolly urmărește un folder și aduce în aplicație tot ce este plasat acolo, prin același selector ca la tragere și plasare.
- <!--i:clock--> **Your activity** - ce ai creat pe acest dispozitiv, numărat local.
- <!--i:sliders--> **Feature flags** - activează sau dezactivează părți ale aplicației, precum **Print preflight** sau **Strip metadata from uploads**. **Performance UI** oferă aplicației un aspect mai simplu, care necesită mai puține resurse pentru afișare. Lolly poate activa singur Performance UI pe un dispozitiv lent. Linia de sub comutator arată atunci când și de ce, împreună cu **Allow again** ([cum decide](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - de unde își ia această instalare instrumentele și catalogul. Vezi [Instanța Lolly](#lolly-instance).

Cardurile de temă sunt previzualizări live. O temă se aplică imediat ce o alegi, doar pe acest dispozitiv.

![Trei carduri de temă, fiecare cu o previzualizare a propriei tipografii și culori, cu cel activ marcat](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accesibilitate

**Settings → Preferences → Accessibility** conține patru setări de confort pentru aplicație. Fiecare este oprită până când o activezi și niciuna nu intervine în canvasul unui instrument sau într-un export, așa că o aplicație mai liniștită nu mută niciun pixel din fișierul pe care îl trimiți. Fiecare este oprită implicit. Niciuna nu schimbă canvasul unui instrument sau un export.

- <!--i:pause--> **Reduce motion** dezactivează tranzițiile, glisările și efectele decorative ale aplicației.
- <!--i:photos--> **Hide colourful previews** înlocuiește grafica de previzualizare a galeriei cu carduri cu pictogramă și text și estompează miniaturile proiectelor, care rămân recognoscibile.
- <!--i:sliders--> **High contrast** accentuează marginile, textul și contururile de focus ale aplicației. Culorile brandului tău și canvasul rămân așa cum le-ai setat.
- <!--i:font--> **Large text** mărește etichetele, meniurile și textul butoanelor aplicației.

**Dominant hand** (Right sau Left) stabilește partea pe care apar controalele când Lolly afișează două panouri, pe un dispozitiv pliabil sau pe o tabletă aproape pătrată. **Swap sides** din antetul unui panou schimbă și el acest lucru.

Aceste setări sunt păstrate în profilul tău, așa că sunt incluse într-un export al profilului, împreună cu numele și sesiunile tale. O copie păstrată doar pe dispozitiv le aplică înainte de prima afișare.

Același card conține **Sound**, sunete discrete de asistență pentru acțiuni precum intrarea în galerie, un rezultat Content Credentials sau închiderea unui panou. Conține și **Neurospicy Mode**, o pistă audio calmă pentru concentrare. Activarea Neurospicy deschide un mic player în colț, care te însoțește în toată aplicația. În player alegi o piesă, treci la următoarea, reglezi volumul și minimizezi sau închizi playerul. Piesele includ posturile generate de Lolly, bucle ambientale și ritmuri, propriile fișiere audio și posturi de radio pe internet, care necesită conexiune. Ambele sunt oprite implicit, iar setările sunt memorate. Oprirea Sound dezactivează și sunetul pistei pentru concentrare. Meniul profilului și **This device** au același comutator.

Un glisor de sub comutatorul Sound stabilește din ce sunt alcătuite sunetele. Spre forma rotunjită **Bouba**, devin picături delicate, bule și puțin bas. Spre steaua ascuțită **Kiki**, devin ticuri seci, zgârieturi și sunete metalice. Mijlocul păstrează clopoțeii și notele Lolly. Dacă sunetele de la un capăt sunt greu de suportat pentru tine, deplasează-te spre celălalt. Glisorul funcționează și când Sound este oprit, iar eliberarea lui redă o mostră scurtă.

::: details Posturile generate
Posturile generate își compun muzica în timp ce o redau, fără sample-uri și fără voci înregistrate. Fiecare melodie are propriile instrumente, propriul ritm și propria succesiune.

- **Lolly Sings** este o familie de posturi. Lolly Sings original este luminos și melodic: tonalități majore, o linie principală în fiecare melodie și influențe de bossa, shuffle și chiptune. Fiecare gen are și propriul post, de la Sugar și K-pop la Country, Jazz, Metal și D&B.
- **Posturile Lofi** (Warm, Late night și Rainy) redau ritmuri lo-fi fără sfârșit.

La un post generat, comenzile următor și anterior trec de la o melodie la alta. Fiecare melodie pornește de la o valoare inițială, așa că este redată la fel oriunde o partajezi sau o salvezi (vezi [Muzică generată](/info/generated-music.html)). Sub comenzile de redare, **Mood** comută între posturile Lofi, **Drums** elimină setul de tobe, iar **Texture** merge de la sunet curat la un disc prăfuit. Urmează un rând de butoane cu pictograme. Treci cursorul peste un buton sau apasă-l lung ca să-i vezi numele:

- Nota muzicală, **Open in the music generator**, deschide melodia la `#/music`, unde îi poți schimba instrumentele secțiune cu secțiune.
- Linkul, **Share this tune or moment**, oferă un link care redă aceeași melodie sau unul care pornește și din punctul în care te afli și arată vizualizatorul cu presetarea și culorile tale curente.
- Folderul, **Save to library**, păstrează melodia în resursele tale.
- Fulgerul, **Light visualiser**, este un comutator, descris mai jos.

O melodie salvată apare în grupul postului ei, după tonalitate și tempo. Alegerea melodiei salvate redă din nou aceeași melodie, repetând-o ca pe orice piesă sau trecând mai departe în modul de avansare. Stochează doar postul și numărul melodiei, câțiva octeți, iar muzica este compusă din nou pe măsură ce este redată. Poți redenumi sau șterge o melodie salvată din resursele tale și o poți folosi ca fundal muzical pentru un videoclip. Lolly Demo și Lolly Start includ fiecare șase melodii salvate.

Vizualizatorul aude fiecare piesă la un nivel constant, așa că o piesă liniștită mișcă imaginea la fel de mult ca una puternică, la orice volum. Fiecare gen Lolly Sings și orice melodie salvată dintr-unul dintre ele oferă **Light visualiser**: bare de nivel simple care lasă muzicii timpul de procesare necesar. Light visualiser pornește activat pe ecrane tactile și pe dispozitive cu cel mult patru nuclee sau cel mult 4 GB de memorie.
:::

Poți folosi interfața de la tastatură. Controalele personalizate au etichete pentru cititoarele de ecran. Previzualizarea live a fiecărui instrument este o singură imagine etichetată, care descrie ce afișează.

### Stocare

Indicatorul de stocare arată fiecare octet păstrat de această instalare, pe categorii, în raport cu ce raportează browserul.

![Indicatorul de stocare, cu sesiunile salvate, imaginile și cache-ul defalcate în raport cu ce raportează efectiv browserul](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Sub indicator:

- **Move to another device** conține **Export my data**, **Import data…** și **Export my data & render everything**. [Mută-ți munca pe alt dispozitiv](/info/find-your-work.html#move-your-work-to-another-device) le explică pe rând.
- **Clear cache** elimină fișierele de catalog descărcate, care se descarcă din nou când sunt necesare.
- **Remove automatic checkpoints older than 30 days** eliberează spațiu în History și păstrează versiunile salvate și denumite.
- **Clear all my data** elimină tot ce păstrează Lolly în acest browser, după ce tastezi un cuvânt pentru confirmare. [Dacă ștergi datele browserului](/info/find-your-work.html#if-you-clear-your-browser-data) listează ce dispare.

### Disponibil offline

Lolly stochează în cache doar ecranele pe care le-ai vizitat. **Available offline** descarcă părțile de care vei avea nevoie, cu o singură bară de progres, iar ele continuă să funcționeze fără conexiune.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (fiecare vizualizare, editor și font, inclusiv ecrane pe care nu le-ai deschis niciodată), **Catalogue** (tot catalogul sau **Choose by tag**) și **Guides & docs** (această documentație în limba ta, inclusiv capturile de ecran).
- <!--i:cpu--> **AI models** - fiecare model care rulează pe dispozitiv pe un rând propriu, cu dimensiunea lui: Speech voices, Upscaling models, Background removal, Text recognition, Lolly Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector și Singing voices. Un model de peste 50 MB este marcat **large download**.
- <!--i:wrench--> **Tools** - fiecare instrument se descarcă separat sau **Download all** descarcă toate instrumentele. O bifă înseamnă că este gata de folosit offline.

**Download everything** din partea de sus descarcă aplicația, partea de catalog pe care ai ales-o, ghidurile și toate instrumentele. Bifează **Include all the AI models** ca să adaugi modelele sau descarcă un model de pe rândul lui. Vocile pentru cântat se descarcă doar de pe rândul lor. Politica unei organizații poate dezactiva descărcările AI, iar rândurile indică atunci acest lucru.

Descărcările se reiau de unde s-au oprit dacă anulezi sau pierzi conexiunea. Când revii online, se actualizează și descarcă doar ce s-a schimbat într-o versiune nouă. Dacă browserul nu a acordat permisiunea de stocare persistentă, **Protect downloads** o cere. Fără această permisiune, browserul poate șterge descărcările când are nevoie de spațiu.

### Instanța Lolly

**Lolly instance** arată de unde își ia această instalare instrumentele și catalogul: adresa unei instanțe sau *Bundled with this app* când totul este inclus în pachetul aplicației.

- **Design-system source** arată de unde provine sistemul de design furnizat.
- **Instance console** deschide paginile de administrare ale unei instalări, dacă aceasta le oferă.
- **Change** conectează aplicația desktop la altă instanță. Un browser nu poate încărca instrumente și resurse de la alte origini, așa că pe web secțiunea oferă în schimb **Open a workspace**.
- **Leave** elimină sistemul de design, instrumentele și catalogul instanței. Munca ta rămâne. Vezi [Folosește Lolly în organizația ta](/info/organisation.html#leaving).
- Când ești conectat la o organizație, **Sign out** încheie această sesiune, iar **Sign out everywhere** încheie sesiunile tale de pe toate dispozitivele, inclusiv acesta.

<!--i:eti-monitor-->
## Acest dispozitiv

- <!--i:monitor--> **This Machine** - ecran, metode de intrare, grafică, memorie, codecuri, mecanism de stocare și altele, citite live din această sesiune. Nimic nu este stocat sau trimis. Pe un ecran lat, acest panou se deschide singur, iar fila folosește două coloane.
- <!--i:neurobeat--> **Sound** - sunetele interfeței și buclele Neurospicy pentru concentrare. Sound este singurul comutator din această filă care scrie ceva.
- <!--i:database--> **Storage** - o vizualizare doar pentru citire a indicatorului. Șterge sau transferă datele din [Preferințe](#storage).

<!--i:eti-palette-->
## Sistem de design

Sistemul de design activ, prezentat pentru consultare. Când acest browser conține două sau mai multe sisteme de design, o bandă de coperți din partea de sus le listează. Alege unul ca să-l activezi. **Undo** din notificarea care urmează îl restabilește pe cel anterior.

![Fila Design system în Lolly Demo: o bandă de coperți pentru schimbarea sistemului, apoi coperta cu logoul, numele, nota și valorile numerice care deschid fiecare pagină](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Fila se deschide pe o copertă în culorile sistemului, cu logoul lui, numele în fontul de afișare și nota scrisă de autor. Un rând de valori numerice de pe copertă conține linkuri către fiecare pagină:

- <!--i:palette--> **Colour** - culorile pentru suprafață și text, culoarea primară și cea secundară ale aspectelor deschis și închis, fiecare culoare denumită ca un chip cu numele și codul hex, o bandă pentru fiecare scară de nuanțe și spectrul pentru grafice, plus rolurile culorilor într-o secțiune pliabilă. Selectează o valoare ca să copiezi codul hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis și Code, fiecare afișat în propriul font.
- <!--i:photos--> **Logos** - fiecare fișier de logo pe fundalul pentru care a fost creat.
- <!--i:layers--> **Colourways** - perechea deschis și închis pentru fiecare colourway, când sistemul are mai multe.
- <!--i:sliders--> **Tokens** - rază, spațiere, efecte și degradeuri.
- <!--i:document--> **Print & CMYK** - culorile fixate la o cerneală exactă și condițiile de tipărire pe care le poate declara un PDF CMYK.

Schimbarea sistemului activ este singura modificare pe care o face această filă. Editează un sistem de design în [Lolly Design System Setup](/info/brand-studio.html) la `#/start`, către care trimite coperta. Un sistem doar pentru citire indică acest lucru pe copertă. Sistemele locale pe care le creezi rămân editabile. `/b` și `/brand` sunt linkuri scurte către această filă.

<!--i:eti-grid-->
## Capabilități

Fiecare parte a platformei are un card, în douăsprezece grupuri: Experiențe, Platforme & medii de execuție, Accesibilitate & limbi, Formate de export, Formate de import, Producție tipografică, Automatizare & AI, Determinism & reproductibilitate, Brand & sistem de design, Confidențialitate & proprietatea datelor, Securitate & controlul accesului și Arhitectură (pentru dezvoltatori). Fiecare grup este pliabil și arată numărul de carduri. Un card deschide un dialog cu funcțiile acelei capabilități și, pentru aproximativ jumătate dintre carduri, captura de ecran folosită în această documentație.

Câmpul de căutare de deasupra grupurilor filtrează cardurile pe măsură ce scrii și deschide grupurile care conțin o potrivire. Câmpul arată în câte capabilități caută. O căutare fără potriviri indică acest lucru printr-un mesaj.

Această filă documentează ce poate face Lolly, în pas cu aceste ghiduri. Nu verifică dispozitivul pe care îl folosești; **This device** face asta.

<!--i:eti-gauge-->
## Activitate & statistici

Mai întâi, versiunea aplicației: numărul de instrumente încărcate, formatele de export, mediile pe care rulează platforma și resursele de brand din catalog. Un panou **Catalogue** detaliază ce este inclus în această versiune.

Apoi munca ta: **Your activity** numără ce ai creat pe acest dispozitiv. **Recent creations** și **Latest exports** sunt stive pe care le poți răsfoi prin glisare și apar când au conținut. Ambele deschid un element așa cum era. Aceste contoare rămân pe dispozitiv. O instanță opțională Lolly Work păstrează propriile [date de telemetrie și înregistrări de audit ale organizației](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Linkuri directe

Fiecare filă și secțiune din Settings are propriul link, pe care îl poți salva ca semn de carte sau lipi. [Lolly Search](/info/search.html) își construiește rezultatele **Settings** din același registru ca Settings, așa că redenumirea unei secțiuni nu strică niciodată un rezultat de căutare.

::: details Toate formele de link

- **O filă:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **O secțiune din Preferences:** `#/settings?focus=<section-id>`, precum `#/settings?focus=offline-section`.
- **O secțiune exactă:** id-ul ei ca indicator fără valoare, precum `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` sau `#/settings?cap-formats`. Linkurile mai vechi `#/settings?dash-lock` și `#/settings?dash-palette-wheel` deschid coperta și pagina Colour.
- **O secțiune după cuvânt-cheie:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (pagina Colour) sau `#/settings?tokens`. Două secțiuni pot avea același cuvânt-cheie: `print` aparține atât referinței pentru tipar din fila de brand, cât și grupului Print production, iar prima în ordinea paginii are prioritate. Folosește id-ul ca să alegi una.

Un link direct trece la fila care conține destinația și deschide orice grup pliat în care se află aceasta. Apoi derulează la destinație după ce secțiunile de deasupra se așază în pagină. Adresele retrase `#/platform` și `#/capabilities` se deschid în Settings cu indicatorii de link direct păstrați.
:::

---

**Vezi și:** [Profiluri](/info/profile.html) pentru datele tale și contextele în care creezi. [Lolly Design System Setup](/info/brand-studio.html) pentru editarea conținutului afișat în fila Design system. [Găsește și recuperează-ți munca](/info/find-your-work.html) pentru stocare, copii de siguranță și trecerea pe alt dispozitiv.
