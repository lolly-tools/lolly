# Folosirea Lolly

Deschide un instrument, modifică ce îți permite, salvează rezultatul și partajează-l ca link sau fișier.

Totul rulează pe dispozitivul tău fără cont și funcționează offline după descărcarea instrumentelor și resurselor necesare. Pentru a porni, aplicația are nevoie de un browser sau de o aplicație cu WebGPU. [Medii acceptate](/info/supported-environments.html) listează variantele testate.

**Ciclul de lucru**, în patru pași:

::: steps
- <!--i:eti-home--> **[Deschide un instrument](#find-your-way-around)** Fă clic pe un card de pe ecranul principal. Controalele sunt lângă o previzualizare live.
- <!--i:eti-sliders--> **[Schimbă intrările](#change-what-the-tool-lets-you-change)** Doar intrările pe care autorul le-a lăsat deschise. Fă clic pe design pentru a găsi controlul lui.
- <!--i:eti-folder-plus--> **[Salvează-ți munca](#saving-continuing)** **Save** o păstrează în My library, iar Projects o readuce.
- <!--i:eti-link--> **[Partajează designul](#sharing-your-work)** Un link care include fiecare intrare sau un singur fișier `.lolly`.
:::

<!--i:eti-home-->
## Orientează-te

::: figure using-app-map
Ecranul principal: patru file în partea de sus și bara de la bază. Un instrument deschis își afișează controalele lângă o previzualizare live.
:::

În partea de sus a ecranului principal se află patru file: **Tools**, **Utilities**, **Assets** și **Projects**. Cu Tools creezi. Utilities convertesc, verifică sau curăță un fișier. Assets este biblioteca ta. Projects conține ce ai salvat.

Bara de la bază conține **Open**, **Settings**, un câmp de căutare, o scurtătură **Verify** către Lolly Verify și **Docs**, care deschide aceste ghiduri. Bara apare în Tools, Utilities, Assets, Projects, Settings și ghidurile din aplicație și se ascunde când deschizi un instrument. [Lolly Search](/info/search.html) găsește din acel câmp instrumentele, munca salvată, resursele și setările tale. [Ask Lolly](/info/ask.html) răspunde la o întrebare introdusă cu secțiunea corespunzătoare din aceste ghiduri.

Fă clic pe un card ca să începi o lucrare nouă în acel instrument. Munca salvată se redeschide din **Projects**. La prima vizită, o bandă de întâmpinare din partea de sus a galeriei oferă o acțiune pentru început: **Start making** sub Lolly Demo sau **Make it yours** pentru a configura propriul sistem de design.

![Un card din galerie cu navigare prin exemple și o acțiune New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Fiecare instrument are o vizualizare împărțită: **controale** pe o parte și o **previzualizare** live pe cealaltă. Previzualizarea se actualizează când modifici un control, iar ceea ce vezi se exportă.

![Vizualizarea împărțită a unui instrument - stiva de controale în stânga și graficul cu bare grupate pe care îl desenează live în dreapta](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** este excepția: un canvas liber cu casete pe care le tragi, le redimensionezi și în care scrii, cu propria bară de sus, cronologie și controale de deck. Ghidul său este [Lolly Design: canvasul liber](/info/design.html).

<!--i:eti-sliders-->
## Schimbă ce îți permite instrumentul

Un instrument afișează doar intrările care pot varia. Autorul a fixat culorile, layoutul, tipografia și logica, așa că munca ta îi respectă regulile. Intrările includ text, glisoare, selectoare de culoare, liste derulante, date, selectoare de imagini și grupuri de rânduri repetitive. Unele se află în secțiuni pliabile.

![Stiva de controale a unui instrument - un câmp de text, declanșatoare de culoare și un glisor, fără alte elemente pe care autorul a ales să le blocheze](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Fă clic pe design pentru a-i găsi controlul.** Fă clic pe un element din previzualizare, iar controlul lui este adus în zona vizibilă și primește focus. Într-un grup de rânduri repetitive, rândul pe care ai dat clic se extinde.

**Clear changes**, deasupra controalelor, resetează fiecare intrare la valoarea implicită.

**Opțiunile sistemului de design.** Când sistemul tău de design oferă mai multe colourway-uri, un aspect deschis și unul închis sau o altă opțiune de temă, acestea se află în secțiunea **Design system** de sub controale. O opțiune apare doar dacă modifică acest instrument, așa că un utilitar de fișiere nu afișează secțiunea. Fiecare colourway apare ca un punct în culorile sale, aspectele deschis și închis au două butoane, iar orice altă opțiune este o listă.

Alegerea se aplică acestei piese. Este inclusă în link și în sesiunea salvată. Fiecare culoare legată de sistemul de design urmează alegerea, iar culorile proprii ale aplicației rămân la fel. Lolly Design afișează aceleași opțiuni în fila **Canvas** a Inspectorului. Un instrument ale cărui culori constituie conținutul său poate rămâne pe colourway-ul canonic și atunci nu afișează puncte de colourway. [Lolly Demo în uz](/info/lolly-demo-in-use.html#colourways-on-real-work) prezintă colourway-uri pe muncă reală. Ca să folosești un colourway pentru aplicație și pentru fiecare piesă nouă, alege-l în **Settings → Appearance** ([Personalizează un colourway](/info/colourways.html#make-a-colourway-your-own)).

### Zoom și deplasare în previzualizare

- **Zoom:** Cmd/Ctrl și derulare sau ciupire pe trackpad, cu centrul la cursor. Pe tastatură, `0` sau `Shift+1` încadrează totul, `1` sau `Shift+0` înseamnă 100%, iar `Shift+2` încadrează selecția. `+` / `−` măresc sau micșorează în jurul cursorului când acesta se află deasupra scenei, altfel în jurul centrului.
- **Deplasare:** ține apăsat **Space** și trage sau trage cu butonul din mijloc al mouse-ului. Clicurile obișnuite rămân disponibile pentru a face clic pe părți ale designului.
- **Atingere:** ciupește pentru zoom, trage pentru deplasare și atinge de două ori pentru încadrare.
- **Zoom HUD:** ține apăsată spirala Lolly din colț ca să afișezi `−`, **Fit** și `+`. O atingere scurtă pe spirală deschide în continuare meniul profilului.

În Lolly Design, **Fit all** cuprinde planșele și straturile libere. Zoomul manual poate coborî sub 20% până când pagina umple jumătate din zona vizibilă. Limita strictă este valoarea mai mică dintre 5% din scara obișnuită Fit și 2% zoom absolut.

Schimbarea dimensiunii de ieșire readuce întotdeauna vizualizarea la încadrare.

![HUD-ul de zoom extins din spirala aflată în colțul canvasului - minus, Fit, plus, apoi comutatoarele pentru temă și sunet și mânerul cu care îl muți](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Anulare și refacere

**Cmd/Ctrl-Z** revine cu un pas, iar **Cmd/Ctrl-Shift-Z** (sau **Cmd/Ctrl-Y**) avansează cu un pas. Butoanele **Undo** și **Redo** sunt deasupra controalelor sau în bara de sus în Lolly Design. Fiecare buton devine gri când nu mai are niciun pas disponibil. Un mesaj arată ce intrare a restaurat fiecare anulare și oferă un buton **Redo**.

- **O tragere înseamnă un pas.** Modificările repetate ale aceluiași control într-o jumătate de secundă se unesc într-un singur pas.
- **Se păstrează ultimii 100 de pași.** O editare nouă după o anulare golește stiva de refacere.
- **Într-o casetă de text**, Cmd/Ctrl-Z acționează în câmp, caracter cu caracter. Lolly preia comanda pentru glisoare, liste derulante, culori și comutatoare.
- **Alegerea unui fișier** într-o intrare de fișier nu constituie un pas, deoarece acei octeți sunt păstrați numai pentru această sesiune.

Într-o [colaborare](/info/collaborate.html) live, o modificare de pe celălalt dispozitiv nu intră niciodată în stiva ta de anulare. Anularea rămâne disponibilă până când părăsești instrumentul sau reîncarci. Pentru modificări mai vechi, instrumentele care salvează în timpul lucrului păstrează versiuni anterioare în **History** ([Revino la o versiune anterioară](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Cameră live

Efectele din instrumentul **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art și Glitch) afișează butonul **Go live** când este disponibilă o cameră. Activează-l și efectul urmărește webcam-ul cadru cu cadru. Un export de mișcare înregistrează rezultatul ca GIF, WebM sau MP4. Cadrele sunt procesate pe dispozitivul tău. Camera este eliberată imediat ce te oprești sau ieși din instrument. Fiecare selector de imagini oferă și **Take a photo** pentru un singur cadru.

<!--i:eti-folder-plus-->
## Salvare & continuare

Pentru a păstra ce ai lucrat, apasă **Save**, bifa de lângă **Export** de pe pastila de randare. Lucrările noi ajung în **My library**, cele salvate anterior sunt actualizate în locul lor și nu se descarcă nimic. Același buton **Save** apare și în panoul de export.

Pentru a alege destinația, apasă **Save as**, lângă **Download** în panoul de export. La **Save to a project**, păstrează selecția **My library** sau alege un proiect (**＋ New project…** creează unul), apoi apasă **Save**. **Save as a template** păstrează designul ca [șablon](/info/templates.html), un punct de pornire pentru documente noi. În Lolly Design, găsești **Save as** în meniul Lolly. Pe telefon, apasă **•••**, apoi **File menu**, apoi **Save as**.

![Pastila de randare în două jumătăți: Export, cu o săgeată în sus care deschide panoul de export, și Save, cu o bifă care salvează în același loc](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Apasă **Save** pe pastila de randare sau **Save as** ca să alegi un proiect.
- <!--i:folder--> Elementul ajunge în **My library** sau în proiectul ales.
- <!--i:home--> Mai târziu, apasă **Home** în stânga sus și deschide fila **Projects**.
- <!--i:document--> Deschide elementul. Toate setările sunt restabilite, gata de schimbat și exportat din nou.
:::

Elementele preiau numele de fișier introdus în panoul de export sau, dacă nu ai introdus unul, numele instrumentului lor, de exemplu **QR Code**. Un fișier obținut prin **Download** este o copie finalizată. Ca să-l modifici ulterior, deschide elementul salvat în Projects.

::: note Salvările rămân pe acest dispozitiv
Salvările personale rămân pe acest dispozitiv, în browserul sau aplicația din care ai salvat, dacă nu activezi [Sync](/info/sync.html).
:::

Dacă ceva nu este unde te aștepți, [Găsește și recuperează-ți munca](/info/find-your-work.html) acoperă toate situațiile, de la o filă închisă la date de browser șterse.

::: details Proiecte de echipă cu Lolly Work (opțional)
Dacă [organizația ta folosește Lolly Work](/info/organisation.html), conectează-te la instanța ei și deschide **Projects → Team projects** pentru sesiunile partajate cu tine. Organizația stabilește accesul și perioada de păstrare, iar serviciul ei Lolly Work stochează acele sesiuni. Când organizația permite editarea live, deschiderea unei sesiuni partajate te alătură colaborării ei live. [Lucrul împreună](/info/collaborate.html#collabs-through-lolly-work-optional) explică pașii.

Biblioteca ta personală rămâne separată. Conectarea pe alt dispozitiv îți oferă acces la munca echipei. Salvările personale au în continuare nevoie de Sync sau de o copie de siguranță ca să fie transferate.
:::

<!--i:eti-link-->
## Partajează-ți munca

Partajează un design ca link sau ca fișier. **Share** din controalele de export deschide un dialog care le oferă pe ambele. **Share link** pentru o sesiune salvată în Projects deschide același dialog pentru acea sesiune. După ce trimiți un fișier în Google Drive, Nextcloud, un bucket S3, Dropbox sau OneDrive, dialogul poate crea și un link prin acel serviciu ([Exportă un fișier](/info/exporting.html#how-export-works)).

::: cols
## Un link

- Include fiecare intrare în adresă, astfel încât linkul reproduce designul.
- Lasă deoparte imaginile și fișierele adăugate de pe acest dispozitiv, textele foarte lungi și listele foarte mari.
- Se deschide în orice browser, așa că poți salva linkul ca semn de carte, îl poți lipi sau îl poți include într-un commit.

## Un fișier .lolly

- Include sesiunea salvată cu imaginile și fișierele de pe acest dispozitiv și poate include și instrumentul și sistemul de design.
- Exclude grafica din catalog supusă unei licențe, dacă nu alegi să incluzi fișierele.
- Se deschide în Lolly: fă dublu clic pe el, folosește **Open** sau trage-l peste aplicație.
:::

### Linkul

Linkul se află în partea de sus a dialogului, alături de **Copy** și un buton **QR** care deschide instrumentul QR Code cu acel link. Sub link, **Link options** conține:

- **Open in the installed app** transformă linkul într-o adresă `lolly://` pentru Shortcuts, lansatoare și automatizare, păstrând fiecare parametru neschimbat.
- **Shortest link** împachetează un design lung într-un token compact și arată câte caractere se economisesc. Forma lizibilă rămâne disponibilă.
- **Password-protect this link** criptează linkul pe dispozitivul tău cu AES-256. Parola nu face niciodată parte din link.
- **Pin this tool version** adaugă indicatorul `_v`, astfel încât o actualizare ulterioară a instrumentului nu poate schimba ce randează linkul.
- **When the recipient opens the link…** alege ecranul complet, panoul de export deja extins, o descărcare la deschidere (`&export`) sau o copiere în clipboard (`&copy`).
- **Copy credit** copiază textul „Creat cu Lolly” împreună cu linkul, pentru o postare sau un diapozitiv.

Când un instrument conține câmpuri personale, precum numele tău, **Review personal fields** exclude fiecare câmp din link până când îl bifezi. [Modul URL](/info/url-mode.html) acoperă tot ce poate include un link.

**Dialogul spune ce nu poate include un link.** Când construiește linkul, Lolly numără tot ce nu încape într-o adresă. Dacă a fost omis ceva, dialogul listează ce s-a omis și te îndrumă spre opțiunea de fișier. Un link care este doar lung primește o notă mai discretă, cu numărul de caractere.

**În unele instrumente, linkul este întregul produs.** Jump Page adună linkurile tale într-o singură pagină de distribuit: un link de profil, o prezentare sau o vitrină de magazin. Pagina este linkul, deci nimic nu este găzduit și niciun cont nu stă în spatele paginii. Vizitatorul vede pagina pe toată lățimea, cu câte un link pe scenă pe măsură ce derulează.

![Jump Page în editor: scena cu titlul în partea de sus a paginii, cu scenele cu linkuri dedesubt](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Linkuri gestionate de organizație cu Lolly Work
Pentru partajarea care necesită expirare, revocare sau parolă, Lolly Work oferă linkuri gestionate către sesiuni partajate, instrumente și resurse din catalog. Acestea sunt rezolvate prin serviciul organizației și respectă regulile ei de acces. Sunt separate de linkurile autonome de mai sus. Revocarea unui link nu poate retrage un fișier deja descărcat de cineva. [Randare și partajare](/info/manage/sharing.html) listează tipurile de linkuri și permisiunile.
:::

### Fișierul .lolly

**Download .lolly**, din secțiunea **Editable file** a dialogului Share, scrie designul curent într-un singur fișier. Grafica obișnuită din catalog este inclusă împreună cu imaginile și fișierele de pe acest dispozitiv. Un fișier învechit sau indisponibil rămâne ca referință externă. Înainte de salvare, dialogul arată dimensiunea fișierului, câte fișiere încorporează, la câte face referire și dacă instrumentul este inclus. Dacă dispozitivul tău are un panou de partajare, **Send to…** trimite fișierul către acel panou (AirDrop, partajare pe Android).

**Download project (.lolly)**, din meniul unui dosar din **Projects**, scrie un dosar întreg, astfel încât altcineva să poată continua fiecare sesiune din el. Sesiunile de lot sunt excluse, iar notificarea arată câte. **Download originals**, din același meniu, scrie o arhivă zip simplă în care fiecare element este un fișier separat.

Înainte de trimiterea unui fișier, decizi trei lucruri:

- **Dacă numele tău este inclus.** Numele, emailul și organizația ta sunt scrise doar când **Use my details to create** este activat în [profilul tău](/info/profile.html). Când este dezactivat, fișierul înregistrează doar că a fost creat cu Lolly și când.
- **Dacă este inclusă grafica reținută.** Grafica supusă unei licențe și cea restricționată de brand sunt excluse implicit, la fel ca o lucrare din catalog a cărei licență înregistrată nu poate fi încă citită de Lolly. Dacă designul folosește astfel de lucrări, dialogul arată câte sunt și oferă *Download without them* sau *Include and download*. Includerea lor transmite fișierele oricui deschide `.lolly`. O lucrare din catalog fără informații înregistrate despre drepturi este inclusă, iar dialogul le listează pe fiecare ca să le poți verifica înainte de trimitere. `CREDITS.txt` din fișier listează ce a fost inclus și ce nu, împreună cu motivul. [Drepturi creative și atribuiri](/info/creative-rights.html) explică regulile.
- **Dacă este inclus instrumentul.** **Include the tool** împachetează fișierele proprii ale instrumentului, astfel încât designul să se deschidă pe un dispozitiv care nu are acel instrument. Opțiunea este bifată inițial pentru un instrument personalizat, precum un fork, și nebifată pentru un instrument listat în catalogul semnat. Într-o versiune fără catalog semnat, fiecare instrument este considerat personalizat.

**Deschiderea unui fișier.** În aplicațiile desktop și mobile, fă dublu clic sau atinge un `.lolly`, alege **Open with Lolly** sau trimite-l către Lolly din panoul de partajare. În aplicația web, apasă **Open** sau trage fișierul peste Lolly. Fiecare metodă citește mai întâi manifestul fișierului și arată dimensiunea, conținutul și ce se va întâmpla, înainte să fie scris ceva.

::: warning Instalarea unui instrument îi execută codul
Dacă fișierul include un instrument pe care nu îl ai, **Trust this tool?** afișează instrumentul și autorul lui și spune că deschiderea lui execută codul propriu al instrumentului pe dispozitivul tău. **Trust & install** continuă operația.
:::

Dacă refuzi, lucrarea este totuși salvată în Projects și așteaptă până adaugi instrumentul. Un instrument al cărui cod este distribuit ca modul nu poate fi instalat încă în acest fel și este refuzat la fel.

::: details Ce conține un .lolly și cum se deschide
`.lolly` este extensia pachetelor Lolly, iar `format` din `manifest.json` spune ce se află înăuntru:

- Un **design partajat** (`lolly-share`) conține o sesiune salvată, fișierele încorporate și o confirmare pentru tot ce este încă accesibil prin referință. Poate include și instrumentul și sistemul de design. Deschiderea lui adaugă un proiect nou și nu suprascrie niciodată o sesiune.
- Un **proiect partajat** (`lolly-share`, tip `project`) conține un dosar din Projects: subdosarele lui, fiecare sesiune din ele cu propriul card și imaginile stocate acolo. Deschiderea lui adaugă o copie a dosarului. Fiecare sesiune este inclusă ca `sessions/<key>.json`, cu propriul card în `thumbs/`. O versiune Lolly de dinaintea apariției fișierelor de proiect îți cere să o actualizezi.
- Un **pachet de sistem de design** (`lolly-brand`) conține tokenuri și poate conține fonturi, logouri, versiuni publicate și resurse păstrate. Deschiderea pachetului adaugă un sistem de design separat, cu nume, și îl activează.
- Un **pachet de spațiu de lucru sau de instanță** este un `lolly-brand` cu instrumente declarate, resurse din catalog și, opțional, o adresă de instanță. Încărcarea lui înlocuiește unicul strat de configurare al spațiului de lucru încărcat anterior, iar previzualizarea listează aceste efecte la nivelul întregului dispozitiv.

O copie de siguranță completă a dispozitivului nu este un `.lolly`. Rămâne un `LollyTools-….zip` (format `lolly-backup`) și se restaurează prin **Settings → Storage → Import data…**. Și un dosar de instrument arhivat rămâne un `.zip`. [Transfer de date](/info/data-transfer.html) este referința pentru formate.

Un `.lolly` este o arhivă zip obișnuită. Redenumește-l `.zip` ca să vezi ce conține. Imaginile tale sunt în `assets/uploads/`, iar grafica din catalog în `assets/catalog/`. `manifest.json` listează fiecare fișier, iar un README spune ce este fișierul.

macOS, Windows, Linux, iOS și Android înregistrează toate formatul. Managerii de fișiere desktop afișează fișierul ca document Lolly, iar GNOME Files poate afișa miniatura proprie a unei sesiuni salvate. Deschiderea din Lolly Design System Setup recomandă acțiunea pentru sistemul de design când un design partajat include unul, dar nu ascunde niciodată **Open shared design**.

Pe iOS sau Android, un document primit din altă aplicație este limitat la 48 MB, iar aplicația spune acest lucru. Transferul copiază octeții între aplicații. **Open** din Lolly nu are această limită, așa că folosește-l pentru un pachet mai mare.

După ce confirmi, Lolly dezarhivează și verifică pachetul o singură dată. Resursele ajung în biblioteca ta, potrivite după suma de control, astfel încât un fișier deja prezent pe dispozitiv este reutilizat. Sesiunile ajung în Projects cu ID-uri noi, așa că același fișier poate fi deschis de două ori. O sesiune al cărei instrument lipsește așteaptă acolo. Fișierele de peste 100 MB sunt marcate ca mari, iar previzualizarea avertizează când stocarea browserului raportează mai puțin spațiu liber decât are nevoie fișierul. Fiecare parte acoperită de verificarea integrității este verificată înainte de orice salvare definitivă, iar o copie deteriorată este refuzată fără să lase nimic în urmă.
:::

Atât un link, cât și un fișier transmit o copie a stării curente. Pentru editare live, [Lucrul împreună](/info/collaborate.html) acoperă colaborările private între două dispozitive și colaborările opționale de lucru prin Lolly Work.

<!--i:eti-images-->
## Assets - biblioteca ta

**Lolly Assets** (`#/a`) conține resursele pe care le pot folosi instrumentele tale: logouri de brand, imagini, audio și mișcare, grupate după tip, și fișierele tale. Fișierele încărcate de tine sunt stocate pe dispozitivul tău. O organizație care folosește Lolly Work poate furniza și un catalog partajat, supus propriilor reguli de acces ([Folosește Lolly în organizația ta](/info/organisation.html)).

![Assets, cu mostrele de culoare și fonturile brandului și fișierele încărcate de tine](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Adaugă-ți fișierele.** Trage o imagine, un SVG, un clip audio, un videoclip, un Lottie, un PDF sau un deck PowerPoint în zona de încărcare ori fă clic ca să alegi. Fișierul apare imediat în Assets și în selectorul de resurse al fiecărui instrument. Un PDF cu mai multe pagini sau un `.pptx` întreabă ce pagini sau diapozitive să păstreze, iar fiecare devine o resursă SVG. O imagine adăugată într-un instrument este păstrată neschimbată în **My images**, astfel încât un Content Credential atașat ei rămâne verificabil. Doar un fișier foarte mare te întreabă dacă vrei să-l redimensionezi. **Settings → Storage** arată cât ocupă **My images**. Nu există altă limită decât spațiul de stocare al dispozitivului tău. Pentru a elimina datele EXIF și GPS la încărcare, activează **Strip metadata from uploads** în **Settings → Feature flags**. Content Credentials sunt păstrate în ambele cazuri.
- <!--i:star--> **Marchează ca favorite resursele folosite des.** Pune o stea unei resurse sau unei mostre de culoare a brandului și aceasta este fixată în partea de sus a fiecărui selector.
- <!--i:folder--> **Fă ordine.** Mută o resursă în alt grup, ascunde o resursă partajată a brandului pe care nu o folosești (**Show hidden** o readuce) sau șterge fișierele încărcate de tine. Aceeași bară de selecție ca în Projects acționează asupra întregii selecții.
- <!--i:layers--> **Separă un videoclip de fundalul lui.** Deschide detaliile unui videoclip sau fă clic dreapta pe cardul lui într-un selector de resurse și alege **Remove background…**. Un **On-device model** decupează un subiect dintr-o scenă aglomerată. Un **Colour key** elimină un fundal iluminat uniform, precum un ecran verde, și nu necesită descărcare. **Tolerance**, **Softness** și **Spill removal** ajustează marginea. **Resolution** (360, 480, 720 sau 1080p, fără a depăși sursa) permite alegerea între detaliu și viteză. Decupajul este un WebP sau PNG animat cu transparență, salvat lângă original. Content Credential al sursei însoțește decupajul ca ingredient. [Generat o dată, randat la fel](/info/ai-features.html) explică de ce acesta rămâne o simplă editare.

### Ia-ți paleta și fonturile oriunde

Panoul **Swatches** din Assets arată culorile brandului tău: culorile brandului, culorile adăugate de tine, rampele și spectrul lui. Culorile de rol pe care Lolly le păstrează pentru interfață (text, suprafețe, margini, culori principale de colourway și copii ale unei culori de brand sub alt nume) se află în spatele unui card gri **Show colour roles**, la baza panoului.

Fiecare culoare este un card, ca orice altă resursă. Fă clic pe unul ca să-i deschizi detaliile, selectează câteva pentru a le descărca sau descarcă întreaga paletă în formatul pe care îl citește celălalt instrument al tău:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** sau **CSS classes**, pentru o foaie de stil ori un build. O culoare din afara sRGB își păstrează valoarea din gama extinsă: CSS o setează după valoarea hex, iar JSON păstrează valoarea hex alături de culoarea din gama extinsă, compoziția CMYK și cerneala spot.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, pentru Illustrator sau Photoshop. O culoare fixată la o compoziție CMYK ajunge ca acea mostră CMYK, o cerneală spot ca mostră spot cu nume și o culoare din afara sRGB ca Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, pentru GIMP sau Inkscape, și **SCSS variables**, ambele în sRGB.

![Panoul Swatches - cele cinci butoane de descărcare a paletei în partea de sus, apoi fiecare culoare a brandului ca un chip care îi deschide detaliile](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Selectează mai multe culori sau deschide detaliile unei culori
Selectează culorile folosind punctul de pe fiecare card: fă Shift-clic pe al doilea punct ca să selectezi tot ce se află între ele, trasează o casetă prin spațiile goale sau apasă Cmd/Ctrl+A când un card are focus. Bara oferă **Download as…** în aceleași șase formate, **Copy hex** și **Favourite**. Înainte să alegi un format, meniul listează culorile pe care niciun format nu le poate păstra (Transparent nu are culoare), formatele care salvează o culoare din gama extinsă ca variantă de rezervă sRGB (SCSS și GIMP) și cele care includ valorile CMYK și spot (JSON și .ase). Fă clic dreapta pe un card pentru aceleași acțiuni aplicate unei singure culori.

Detaliile unei culori umplu previzualizarea cu acea culoare și extind **Linked values** (compoziția CMYK sau cerneala spot, orice valoare definită pentru un anumit spațiu sau o anumită presă și tokenul de design), **Every notation** (hex, OKLCH, Display-P3 și celelalte, fiecare cu un buton de copiere), **Plotted on a colour space**, **Tones** și **Readability**. Tastele săgeți parcurg paleta, **Copy link** partajează culoarea și **Open in Colour Lab** o deschide pentru a continua lucrul.
:::

Panoul **Fonts** listează fonturile brandului tău, cu un **download** pentru fiecare, ca să le instalezi local sau să le trimiți unei tipografii.

<!--i:eti-grid-->
## Personalizează grila

- <!--i:star--> **Marchează ca favorite instrumentele folosite.** Fă clic dreapta pe un card și alege **Add to favourites**. Instrumentul primește un card mare într-o bandă deasupra grilei. [Favoritele tale](/info/favourites.html) explică banda.
- <!--i:eyeoff--> **Ascunde un instrument pe care nu îl folosești niciodată.** Fă clic dreapta pe un card sau selectează mai multe și alege **Hide tool**. Dispare din grilă și din rezultatele căutării prin tastare în grilă. Instrumentul părăsește grila și nu mai apare când tastezi în ea. Un card gri **Show hidden tools (N)** de la sfârșit arată din nou instrumentele ascunse, estompate, fiecare cu **Unhide tool** în meniu. Ascunderea schimbă doar grila ta: instrumentul se deschide în continuare dintr-un link sau un semn de carte.
- <!--i:clock--> **Instrumentele tale, primele.** După ce ai salvat lucrări în trei instrumente diferite, un rând **Yours** de chip-uri deasupra grilei începe cu favoritele și instrumentele tale recente.
- <!--i:sliders--> **Aranjează cum preferi.** **View options** setează layoutul (**Grid**, **Card** sau **List**), dimensiunea și densitatea cardurilor, ordinea de sortare și un filtru de categorii.

![Capătul grilei Tools cu instrumentele ascunse afișate: cardul Wordmark estompat și, lângă el, cardul gri care l-a readus în vedere, acum cu textul Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Acționează asupra mai multor carduri deodată.** Bifează caseta fiecărui card, trage o casetă de selecție prin spațiul gol sau fă Shift/Cmd-clic și apare o bară cu acțiunile permise de acea vedere:

- **Tools și Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, afișând doar sesiunile create cu acele instrumente) și Copy link pentru un singur card.
- **Assets:** Favourite și Hide pentru orice selecție. Duplicate, Download și Delete apar doar când fiecare element selectat este unul dintre fișierele încărcate de tine, deoarece o resursă partajată a sistemului de design este un contract permanent.
- **Projects:** vezi [Găsește și recuperează-ți munca](/info/find-your-work.html#find-something-you-saved).

![Bara de selecție a galeriei pentru două instrumente, cu Available offline, View sessions, Favourite și Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** apare doar când ceva este selectat. Fă clic dreapta pe un singur card neselectat pentru **N saved sessions**: o listă a sesiunilor salvate ale acelui instrument, unde ștergerea mută o sesiune în Trash.

<!--i:eti-layers-->
## Pe telefon

Pe un ecran îngust, layoutul trece la o singură coloană:

- **Controalele devin un panou** în partea de sus, cu un mâner de tragere pe marginea de jos. Trage mânerul ca să fixezi panoul la **vizualizare restrânsă**, **jumătate** sau **întregul ecran** ori atinge-l ca să restrângi și să extinzi. Previzualizarea umple spațiul de dedesubt și rămâne vizibilă în timpul editării.
- Un buton flotant **Export** deschide panoul de export: format, dimensiune, copiere, salvare și descărcare. Atinge fundalul din spate ca să închizi panoul.

![Un instrument pe un ecran de lățimea unui telefon - controalele într-un panou sus, paleta generată umplând previzualizarea de dedesubt și pastila de randare flotând jos, în centru](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Dispozitive pliabile și iPhone Duo

Pe un dispozitiv pliabil, un iPhone Duo sau un ecran tactil aproape pătrat, Lolly împarte instrumentul în două panouri:

- **Controalele pe o parte, canvasul pe cealaltă.** Controalele stau departe de mâna cu care desenezi. Alege **Dominant hand** în **Settings → Accessibility** sau apasă **Swap sides** în partea de sus a controalelor. Într-o limbă scrisă de la dreapta la stânga, părțile sunt oglindite.
- **Separatorul este balamaua.** Când dispozitivul raportează pliul, panourile se întâlnesc acolo, astfel încât niciun control și nicio grafică nu se află pe îndoitură. Pe un ecran continuu, trage separatorul la o treime, jumătate sau două treimi din lățime. Lolly reține alegerea pentru fiecare vedere pe acest dispozitiv.
- **Pe masă.** Cu dispozitivul pe jumătate deschis și pliul de-a latul ecranului, canvasul ocupă jumătatea de sus, iar controalele stau sub pliu. Când prezinți, diapozitivul este sus, iar notele tale, diapozitivul următor și **Back** și **Next** sunt dedesubt. În Sequence, previzualizarea este sus și cronologia dedesubt.
- **Lolly Design, Design System Setup și Assets.** În Lolly Design, inspectorul, straturile și panoul de export sunt file lângă canvas. Instrumentele stau de-a lungul marginii exterioare a canvasului, sub mâna cu care desenezi. Când instrumentele nu încap, coloana se derulează și o estompare cu o săgeată arată în ce direcție se află restul. Pe masă, instrumentele sunt de-a lungul bazei canvasului. Lolly Design System Setup păstrează Board pe o parte și camera deschisă pe cealaltă. În Assets, detaliile unei resurse se deschid lângă bibliotecă, astfel încât următoarea atingere arată următoarea resursă în același loc.
- **Nimic pe îndoitură.** Pe un dispozitiv care raportează pliul, un dialog se deschide pe pagina cu controalele. La fel și caseta de căutare de la baza ecranului principal și rezultatele ei. Pe un ecran plat, acestea rămân în mijloc.
- **Plierea nu pierde nimic.** Plierea, desfacerea sau rotirea dispozitivului îți păstrează documentul, selecția, zoomul și câmpul în care scriai, cu cursorul la locul lui.

Ecranul exterior al unui dispozitiv pliabil păstrează layoutul de telefon de mai sus, la fel ca o fereastră Lolly într-o jumătate de ecran împărțit.

<!--i:eti-smile-->
## Setări, sunet și confort

**Settings**, la baza ecranului principal, conține datele tale, sistemele de design, accesibilitatea, stocarea și descărcările offline. [Setările Lolly](/info/dashboard.html) descrie fiecare filă.

- **Datele și fotografia ta de profil** sunt completate în orice instrument conceput să le folosească, precum o semnătură de email sau un ecuson. [Profiluri](/info/profile.html) le explică.
- **Accessibility** are patru comutatoare pentru confort: **Reduce motion**, **Hide colourful previews**, **High contrast** și **Large text**. Ele schimbă aplicația din jurul lucrării tale, niciodată canvasul unui instrument sau un export. Lângă ele, **Dominant hand** alege partea pe care apar controalele în două panouri.
- **Sound** redă sunete discrete de asistență pentru acțiunile tale, iar **Neurospicy Mode** redă o piesă calmă pentru concentrare. Ambele sunt oprite până le activezi în **Settings → Accessibility** sau în meniul profilului. Glisorul **Sound shape** de sub comutatorul Sound schimbă sunetele de la picături moi, rotunde (Bouba) la ticuri și zgârieturi seci (Kiki), cu clopoțeii Lolly la mijloc. Piesele Neurospicy includ stațiile generate de Lolly: **Lolly Sings** și genurile sale și trei **Lofi stations**. Stațiile creează muzică fără sfârșit în timpul redării. Fiecare are controale pentru tobe și textură (și atmosferă, la Lofi), un link pentru a partaja melodia pe care o auzi și un buton care salvează melodia în resursele tale. [Muzică generată](/info/generated-music.html) explică modul de creare a unei melodii. **Music generator** din Utilities (`#/music`) îți permite să modelezi una.
- **Available offline** descarcă restul aplicației, instrumentele tale, catalogul și ghidurile înainte să pierzi conexiunea. Pentru a instala Lolly ca aplicație web, folosește butonul de instalare al browserului sau *Add to Home Screen* pe telefon. Aplicația instalată rulează pe ecran complet și se actualizează singură când revii online.
- **Performance UI**, din **Settings → Feature flags**, oferă aplicației un aspect mai simplu, care necesită mai puține resurse pentru afișare. Canvasurile instrumentelor și exporturile rămân la fel. Pe un dispozitiv lent, Lolly activează singur acest aspect și spune de ce, cu **Undo** și **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** arată ce păstrează Lolly pe acest dispozitiv. [Dacă ștergi datele browserului](/info/find-your-work.html#if-you-clear-your-browser-data) explică ce elimină ștergerea, iar [Politica de confidențialitate](/info/privacy.html) listează tot ce preia sau trimite aplicația.

::: note Dacă o vedere nu se încarcă după o actualizare
Un panou gol sau un mesaj „failed to fetch” imediat după o actualizare dispare de obicei după o reîncărcare. Lucrările salvate, sesiunile și sistemele de design rămân intacte, deoarece sunt stocate pe dispozitivul tău. Doar o imagine pe care ai adăugat-o și nu ai salvat-o niciodată ar putea necesita adăugarea din nou.
:::

<!--i:eti-map-pin-->
## Unde mergi mai departe

- **[Lolly Design: canvasul liber](/info/design.html)**: canvasul, formele, cronologia și prezentarea unui deck.
- **[Loturi și Lolly Multi-edit](/info/batch.html)**: multe versiuni ale unui design sau mai multe designuri salvate editate împreună.
- **[Exportă un fișier](/info/exporting.html)**: alegerea formatului, dimensiunii, unităților de tipar, transparenței și opțiunilor video.
- **[Importă un design](/info/design-import.html)**: adu un fișier Figma, Penpot, Illustrator, InDesign, Affinity sau DXF în Lolly Design și continuă editarea.
- **[Șabloane](/info/templates.html)**: puncte de pornire salvate pentru un instrument.
- **[Gamă extinsă de culori și HDR](/info/hdr-editing.html)**: păstrează precizia originală a imaginilor în Lolly Design și Lolly Darkroom.
- **[Găsește și recuperează-ți munca](/info/find-your-work.html)**: unde se află totul și cum să muți lucrurile pe alt dispozitiv.
