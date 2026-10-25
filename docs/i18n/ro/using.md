# Cum folosești Lolly

Ai Lolly deschis și vrei să faci ceva, să păstrezi și să trimiți mai departe. Această pagină parcurge bucla: deschide un instrument, schimbă ce îți permite să schimbi, salvează rezultatul și partajează-l ca link sau fișier.

Tot ce este aici rulează pe dispozitivul tău, fără cont, și continuă să funcționeze offline după ce instrumentele și resursele de care ai nevoie sunt descărcate. Aplicația are nevoie de un browser sau o aplicație cu WebGPU ca să pornească; [Medii acceptate](/info/supported-environments.html) le listează pe cele testate.

## Orientează-te

::: figure using-app-map
Ecranul principal: patru file sus și bara de la bază. Un instrument, odată deschis, arată controalele lui lângă o previzualizare live.
:::

Patru file merg sus pe ecranul principal: **Tools**, **Utilities**, **Assets** și **Projects**. Tools sunt ce folosești ca să creezi, Utilities sunt bancuri de lucru pentru sarcini precum convertirea, verificarea sau curățarea unui fișier, Assets este biblioteca ta, iar Projects păstrează ce ai salvat.

Bara de la bază conține **Open**, **Settings**, un câmp de căutare, **Verify** și **What?**. Apare în Tools, Utilities, Assets, Projects, Settings și ghidurile pe care le citești în aplicație și face loc când un instrument este deschis. [Căutarea](/info/search.html) ajunge din acel câmp la instrumentele, munca salvată, resursele și setările tale. [Ask Lolly](/info/ask.html) răspunde la o întrebare tastată cu secțiunea potrivită din aceste ghiduri.

Fă clic pe un card ca să începi ceva nou în acel instrument. Munca salvată se redeschide în schimb din **Projects**.

![O cartelă din galerie cu un exemplu de navigare și o acțiune Nou](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Fiecare instrument este o vedere împărțită: **controale** pe o parte și o **previzualizare** live pe cealaltă. Schimbi un control și previzualizarea urmează imediat, iar ce vezi este ce se exportă.

![Vizualizarea împărțită a unui instrument - stiva de comenzi în stânga și graficul cu bare grupate randat live pe care îl desenează în dreapta](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** este excepția. Se deschide ca un canvas liber de casete pe care le tragi, redimensionezi și în care scrii, cu propria bară de sus, cronologie și controale de deck. [Design: canvasul liber](/info/design.html) este ghidul lui.

## Schimbă ce îți permite instrumentul să schimbi

Un instrument arată doar intrările menite să varieze. Autorul lui a fixat deja culorile, layoutul, tipografia și logica, deci tot ce faci respectă regulile lui. Intrările includ text, glisoare, selectoare de culoare, liste derulante, date, selectoare de imagini și grupuri de rânduri repetitive, iar unele stau în secțiuni pliabile.

![Stiva de comenzi a unui instrument - un câmp de text, declanșatoare de culoare și un glisor, și nimic altceva din ce a ales autorul să fixeze](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Fă clic pe design ca să-i găsești controlul.** Fă clic pe orice element din previzualizare și controlul potrivit primește focus și derulează în vedere. Într-un grup de rânduri repetitive se deschide chiar rândul pe care ai dat clic.

**Clear changes**, deasupra controalelor, readuce fiecare intrare la valoarea implicită.

**Alegeri ale sistemului de design.** Când sistemul tău de design oferă mai mult de un colourway, un aspect deschis și unul închis sau altă alegere de temă, o secțiune **Design system** sub controale le conține. O alegere apare doar când schimbă acest instrument, deci un utilitar de fișiere nu arată nicio secțiune. Fiecare colourway este un punct în propriile culori, deschis și închis sunt două butoane, iar orice altă alegere este o listă.

Alegerea aparține acestei piese. Călătorește în link și în sesiunea salvată, fiecare culoare legată de sistemul de design o urmează, iar culorile proprii ale aplicației rămân neschimbate. Design arată aceleași alegeri în fila **Canvas** a Inspectorului. Un instrument ale cărui culori sunt conținutul lui poate rămâne pe colourway-ul canonic și atunci nu oferă puncte de colourway. [Lolly Demo în uz](/info/lolly-demo-in-use.html#colourways-on-real-work) arată colourway-uri pe muncă reală.

### Mărește și deplasează previzualizarea

Previzualizarea arată mereu exact ce se va exporta.

- **Zoom:** Cmd/Ctrl și derulare sau ciupire pe trackpad, centrat pe cursor. De la tastatură, `0` sau `Shift+1` încadrează totul, `1` sau `Shift+0` setează 100%, iar `Shift+2` încadrează selecția. `+` / `−` fac zoom în jurul cursorului când este deasupra scenei, iar în rest în jurul centrului.
- **Deplasare:** ține apăsat **Space** și trage sau trage cu butonul din mijloc al mouse-ului. Clicurile simple rămân libere pentru a da clic pe părți ale designului.
- **Atingere:** ciupește pentru zoom, trage pentru deplasare și atinge de două ori pentru a încadra.
- **Zoom HUD:** apasă lung pe spirala Lolly din colț ca să desfaci `−`, **Fit** și `+`. O atingere scurtă pe spirală deschide în continuare meniul profilului tău.

În Design, **Fit all** include planșele și straturile libere. Poți micșora manual sub 20% până când întreaga pagină ocupă jumătate din zona vizibilă. Limita inferioară este valoarea mai mică dintre 5% din scara Fit obișnuită și 2% zoom absolut.

O schimbare a dimensiunii de ieșire readuce mereu vederea la o încadrare curată.

![HUD-ul de zoom desfăcut din spirala din colțul canvasului - minus, Fit, plus, apoi comutatoarele de temă și sunet și mânerul care îl mută](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Anulare și refacere

**Cmd/Ctrl-Z** face un pas înapoi, iar **Cmd/Ctrl-Shift-Z** (sau **Cmd/Ctrl-Y**) face un pas înainte. Aceeași pereche apare ca butoane **Undo** și **Redo** deasupra controalelor (în Design sunt în bara de sus), iar fiecare devine gri când nu mai e nimic de dat înapoi. Un mesaj spune ce intrare a restaurat fiecare undo, cu un buton **Redo** în mesaj.

- **O tragere este un pas.** Schimbările repetate ale unui control în jumătate de secundă se contopesc, deci tragerea unui glisor pe tot parcursul lui este un singur undo.
- **Ultimii 100 de pași sunt păstrați.** O editare nouă după un undo șterge stiva de înainte.
- **Într-o casetă de text**, Cmd/Ctrl-Z aparține câmpului, caracter cu caracter. Lolly preia glisoarele, listele derulante, culorile și comutatoarele.
- **Alegerea unui fișier** într-o intrare de fișier nu este un pas, pentru că acei octeți sunt ținuți doar pentru această sesiune.

Într-o [colaborare](/info/collaborate.html) live, istoricul rămâne al tău: o schimbare de pe celălalt dispozitiv nu ajunge niciodată în stiva ta. Undo durează până părăsești instrumentul sau reîncarci. Pentru ceva mai vechi, instrumentele care salvează pe măsură ce lucrezi păstrează versiuni anterioare în **History**; vezi [Întoarce-te la o versiune anterioară](/info/find-your-work.html#go-back-to-an-earlier-version).

### Cameră live

Efectele instrumentului **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art și Glitch) arată un buton **Go live** unde o cameră este disponibilă. Pornește-l și efectul urmează webcam-ul cadru cu cadru, iar un export de mișcare înregistrează rezultatul ca GIF, WebM sau MP4. Cadrele sunt procesate pe dispozitivul tău, iar camera este eliberată în clipa în care te oprești sau părăsești instrumentul. Orice selector de imagini are și **Take a photo** pentru un singur cadru.

## Salvare & continuare

Ca să-ți păstrezi munca, apasă **Save**, bifa de lângă **Export** de pe pastila de randare. Munca nouă merge în **My library**, munca salvată înainte este actualizată acolo unde se află și nu se descarcă nimic. Panoul de export are același buton **Save**.

Ca să alegi unde merge, apasă **Save as**, lângă **Download** în panoul de export. Sub **Save to a project**, lasă selectat **My library** sau alege un proiect (**＋ New project…** face unul), apoi apasă **Save**; **Save as a template** păstrează designul ca [șablon](/info/templates.html), un punct de pornire pentru documente noi. În Design, **Save as** este în meniul Lolly; pe telefon, apasă **•••**, apoi **File menu**, apoi **Save as**.

![Pastila de randare în două jumătăți: Export, cu o săgeată în sus care deschide panoul de export, și Save, cu o bifă care salvează pe loc](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Apasă **Save** pe pastila de randare sau **Save as** ca să alegi un proiect.
- <!--i:folder--> Elementul merge în **My library** sau în proiectul ales.
- <!--i:home--> Mai târziu, apasă **Home** în stânga sus și deschide fila **Projects**.
- <!--i:document--> Deschide elementul. Fiecare setare este înapoi, gata de schimbat și exportat din nou.
:::

Elementele sunt denumite după numele de fișier tastat în panoul de export sau, altfel, după instrumentul lor, precum **QR Code**. Un fișier obținut cu **Download** este o copie finită; ca să-l schimbi mai târziu, deschide elementul salvat în Projects.

Salvările personale rămân pe acest dispozitiv, în browserul sau aplicația din care ai salvat, dacă nu activezi [Sync](/info/sync.html). Dacă ceva nu este unde te aștepți, [Găsește și recuperează-ți munca](/info/find-your-work.html) acoperă fiecare caz, de la o filă închisă la date de browser șterse.

::: details Proiecte de echipă cu Lolly Work (opțional)
Dacă [organizația ta folosește Lolly Work](/info/organisation.html), autentifică-te în instanța ei și deschide **Projects → Team projects** pentru sesiunile partajate cu tine. Organizația stabilește accesul și păstrarea, iar serviciul ei Lolly Work stochează acele sesiuni. O sesiune partajată se alătură collab-ului ei live pe măsură ce se deschide, când organizația ta permite editarea live; [Lucrul împreună](/info/collaborate.html#work-collabs-with-lolly-work-optional) explică pașii.

Biblioteca ta personală rămâne separată. Autentificarea pe alt dispozitiv îți dă munca de echipă, în timp ce salvările personale au în continuare nevoie de Sync sau de o copie de siguranță ca să treacă dintr-un loc în altul.
:::

## Cum îți partajezi lucrarea

Un design pleacă ca link sau ca fișier. **Share** din controalele de export deschide un dialog care le oferă pe ambele, iar **Share link** pe o sesiune salvată din Projects deschide același dialog pentru acea sesiune.

::: cols
## Un link

- Poartă fiecare intrare în adresă, deci linkul reproduce designul.
- Lasă în urmă imaginile și fișierele adăugate de pe acest dispozitiv, textele foarte lungi și listele foarte mari.
- Se deschide în orice browser, deci poți pune linkul la favorite, îl poți lipi sau comite.

## Un fișier .lolly

- Poartă sesiunea salvată cu imaginile și fișierele de pe acest dispozitiv și poate purta și instrumentul și sistemul de design.
- Reține arta licențiată din catalog, dacă nu alegi să incluzi fișierele.
- Se deschide în Lolly: dublu clic pe el, folosește **Open** sau plasează-l pe aplicație.
:::

### Linkul

Linkul gata de copiat stă în partea de sus a dialogului, cu **Copy** și un buton **QR** care deschide instrumentul QR Code pe link. Sub link, **Link options** conține:

- **Open in the installed app** schimbă linkul într-o adresă `lolly://` pentru Shortcuts, lansatoare și automatizare, cu fiecare parametru neschimbat.
- **Shortest link** împachetează un design lung într-un token compact și arată economia în caractere. Forma lizibilă este mereu disponibilă și ea.
- **Password-protect this link** criptează linkul pe dispozitivul tău cu AES-256. Parola nu face niciodată parte din link.
- **Pin this tool version** adaugă indicatorul `_v`, deci o actualizare ulterioară a instrumentului nu poate schimba ce randează linkul.
- **When the recipient opens the link…** alege ecran complet, panoul de export deja extins, o descărcare la deschidere (`&export`) sau o copiere în clipboard (`&copy`).
- **Copy credit** copiază o legendă „Made with Lolly” împreună cu linkul, pentru o postare sau un diapozitiv.

Când un instrument conține câmpuri personale, precum numele tău, **Review personal fields** ține fiecare câmp în afara linkului până îl bifezi. [Modul URL](/info/url-mode.html) acoperă tot ce poate purta un link.

**Dialogul spune ce nu poate purta un link.** O imagine sau un fișier adăugat de pe acest dispozitiv, o valoare de text foarte lungă și o listă foarte mare nu încap într-o adresă. Fiecare este numărată pe măsură ce linkul este construit. Dacă ceva a trebuit omis, dialogul listează și te îndrumă spre opțiunea de fișier, în loc să-ți dea un link care se deschide fără o imagine. Un link doar lung primește o notă mai blândă cu numărul lui de caractere.

**Unele instrumente fac din link întregul produs.** Jump Page adună linkurile tale într-o singură pagină de dat mai departe: un link de bio, o conferință, o vitrină. Nimic nu este găzduit și niciun cont nu stă în spatele paginii, pentru că pagina este linkul. Un vizitator o primește pe toată lățimea, un link pe scenă pe măsură ce derulează.

![Jump Page în editor: scena cu titlul în partea de sus a paginii, cu scenele de linkuri dedesubt](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Linkuri administrate de organizație cu Lolly Work
Pentru partajarea care necesită expirare, revocare sau parolă, Lolly Work oferă linkuri administrate către sesiuni, instrumente și resurse din catalog partajate. Ele se rezolvă prin serviciul organizației și urmează regulile ei de acces. Sunt separate de linkurile de sine stătătoare de mai sus, iar revocarea unuia nu poate rechema un fișier descărcat deja de cineva. [Randare și partajare](/info/manage/sharing.html) listează tipurile de linkuri și permisiunile.
:::

### Fișierul .lolly

**Download .lolly**, în secțiunea **Editable file** a dialogului Share, scrie designul curent ca un singur fișier. Poartă sesiunea salvată cu imaginile și fișierele de pe acest dispozitiv, iar arta obișnuită din catalog merge și ea. Un fișier perimat sau indisponibil rămâne o referință externă, nu dispare. Înainte să salveze, dialogul arată dimensiunea fișierului, câte fișiere încorporează, câte referențiază și dacă instrumentul este inclus. Unde dispozitivul tău are o foaie de partajare, **Send to…** îi dă fișierul direct (AirDrop, o partajare Android).

**Download project (.lolly)**, în meniul unui dosar din **Projects**, scrie un dosar întreg, ca altcineva să poată continua cu fiecare sesiune din dosar. Sesiunile batch rămân în urmă, iar notificarea spune câte. **Download originals**, în același meniu, scrie un zip simplu cu fiecare element ca fișier propriu.

Trei lucruri depind de tine înainte să plece un fișier:

- **Dacă intră numele tău.** Numele, emailul și organizația ta sunt scrise doar când **Use my details to create** este activ în [profilul tău](/info/profile.html). Cu el oprit, fișierul înregistrează doar că a fost făcut cu Lolly și când.
- **Dacă intră arta reținută.** Arta licențiată, arta blocată de brand și lucrările din catalog a căror licență nu a fost niciodată înregistrată rămân implicit în afară. Dacă designul folosește vreuna, dialogul spune câte și oferă *Download without them* sau *Include and download*, pentru că includerea lor dă fișierele oricui deschide `.lolly`. `CREDITS.txt` al fișierului listează ce a călătorit și ce nu, cu motivul; [Drepturi creative și credite](/info/creative-rights.html) explică regulile.
- **Dacă intră instrumentul.** **Include the tool** împachetează fișierele proprii ale instrumentului, deci designul se deschide pe un dispozitiv fără acel instrument. Pornește bifat pentru un instrument personalizat, precum un fork, și nebifat pentru un instrument listat de catalogul semnat. La o versiune fără catalog semnat, fiecare instrument contează ca personalizat.

**Deschiderea unuia.** În aplicațiile desktop și mobile, fă dublu clic sau atinge un `.lolly`, alege **Open with Lolly** sau trimite-l la Lolly din foaia de partajare. În aplicația web, apasă **Open** sau plasează fișierul pe Lolly. Fiecare traseu citește mai întâi manifestul fișierului și arată dimensiunea, conținutul și ce se va întâmpla, înainte să se scrie ceva.

Dacă fișierul poartă un instrument pe care nu îl ai, **Trust this tool?** arată instrumentul și autorul lui și spune că deschiderea lui rulează codul propriu al instrumentului pe dispozitivul tău. **Trust & install** merge mai departe. Dacă refuzi, munca este totuși salvată în Projects, așteptând ziua în care adaugi instrumentul. Un instrument al cărui cod vine ca modul nu poate fi încă instalat astfel și este refuzat la fel.

::: details Ce conține un .lolly și cum funcționează deschiderea
`.lolly` este extensia de bundle a Lolly, iar `format` din `manifest.json` spune ce este înăuntru:

- Un **design partajat** (`lolly-share`) conține o sesiune salvată, fișierele ei încorporate și o confirmare pentru tot ce se rezolvă încă prin referință. Poate purta și instrumentul și sistemul de design. Deschiderea lui adaugă un Project nou și nu suprascrie niciodată o sesiune.
- Un **proiect partajat** (`lolly-share`, tip `project`) conține un dosar din Projects: subdosarele lui, fiecare sesiune din ele cu tila ei și imaginile arhivate acolo. Deschiderea lui adaugă o copie a întregului dosar. Fiecare sesiune călătorește ca `sessions/<key>.json` cu tila ei sub `thumbs/`. Un Lolly dinainte de fișierele de proiect te roagă să actualizezi.
- Un **pachet de sistem de design** (`lolly-brand`) conține tokenuri și poate conține fonturi, logouri, versiuni publicate și resurse păstrate. Deschiderea pachetului adaugă un sistem de design separat, cu nume, și îl face activ.
- Un **pachet de spațiu de lucru sau de instanță** este un `lolly-brand` cu instrumente declarate, resurse de catalog și, opțional, o adresă de instanță. Încărcarea unuia înlocuiește overlay-ul unic de spațiu de lucru încărcat înainte, iar previzualizarea listează acele efecte la nivel de dispozitiv.

O copie de siguranță completă a dispozitivului nu este un `.lolly`. Rămâne un `LollyTools-….zip` (format `lolly-backup`) și se restaurează prin **Settings → Storage → Import data…**. Un dosar de instrument arhivat zip rămâne și el `.zip`. [Transferul de date](/info/data-transfer.html) este referința de format.

Un `.lolly` este un zip obișnuit. Redenumește-l `.zip` ca să te uiți înăuntru: imaginile tale sunt sub `assets/uploads/`, arta din catalog sub `assets/catalog/`, `manifest.json` listează fiecare fișier, iar un README spune ce este fișierul.

macOS, Windows, Linux, iOS și Android înregistrează toate formatul, managerele de fișiere desktop îl arată ca document Lolly, iar GNOME Files poate arăta miniatura proprie a unei sesiuni salvate. Deschiderea din Design System Setup recomandă acțiunea de sistem de design când un design partajat poartă unul, dar nu ascunde niciodată **Open shared design**.

Un document predat din altă aplicație pe iOS sau Android este plafonat la 48 MB, pentru că predarea copiază octeții peste granița aplicației, iar aplicația spune asta. **Open** din interiorul Lolly nu are un astfel de plafon, deci folosește-l pentru un bundle mai mare.

După ce confirmi, Lolly dezarhivează și verifică bundle-ul o singură dată. Resursele merg în biblioteca ta, potrivite după sumă de control, deci un fișier deja aflat pe dispozitiv este refolosit. Sesiunile merg în Projects cu id-uri noi, deci același fișier poate fi deschis de două ori; o sesiune al cărei instrument lipsește așteaptă acolo. Fișierele de peste 100 MB sunt semnalate ca mari, iar previzualizarea avertizează când spațiul de stocare al browserului raportează mai puțin spațiu liber decât are nevoie fișierul. Fiecare parte acoperită de integritate este verificată înainte să se confirme ceva, iar o copie deteriorată este refuzată fără să rămână nimic în urmă.
:::

Atât un link, cât și un fișier predau o instantanee. Pentru editare live, [Lucrul împreună](/info/collaborate.html) acoperă collab-urile private între două dispozitive și work collab-urile opționale prin Lolly Work.

## Resurse - biblioteca ta

**Assets** (`#/a`) adună tot ce pot folosi instrumentele tale: logouri de brand, imagini, audio și mișcare, grupate pe tip, împreună cu propriile fișiere. Încărcările tale sunt stocate pe dispozitivul tău. O organizație care folosește Lolly Work poate furniza și un catalog comun sub propriile reguli de acces; vezi [Folosește Lolly în organizația ta](/info/organisation.html).

![Resurse, cu mostrele și fonturile brandului și propriile tale încărcări](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Adu-ți fișierele.** Plasează o imagine, un SVG, un clip audio, un video, un Lottie, un PDF sau un deck PowerPoint pe zona de încărcare sau fă clic ca să alegi. Ajunge imediat în Assets și în selectorul de resurse al fiecărui instrument. Un PDF cu mai multe pagini sau un `.pptx` întreabă ce pagini sau diapozitive să păstreze, iar fiecare devine o resursă SVG. O imagine adăugată într-un instrument este păstrată așa cum a sosit în **My images**, deci un Content Credential de pe ea se verifică în continuare, iar doar un fișier foarte mare întreabă dacă să fie redimensionat. **Settings → Storage** arată cât conține **My images**. Nu există plafon dincolo de stocarea dispozitivului tău. Ca să ștergi datele EXIF și GPS pe măsură ce intră imaginile, activează **Strip metadata from uploads** în **Settings → Feature flags**; Content Credentials sunt păstrate în ambele cazuri.
- <!--i:star--> **Pune la favorite ce folosești.** Pune o stea pe o resursă sau pe o mostră de brand și se fixează sus în fiecare selector.
- <!--i:folder--> **Fă ordine.** Mută o resursă în alt grup, ascunde o resursă de brand comună pe care n-o folosești (**Show hidden** o aduce înapoi) sau șterge-ți încărcările. Aceeași bară de selecție ca în Projects acționează pe o selecție întreagă.
- <!--i:layers--> **Ridică un video de pe fundalul lui.** Deschide detaliile unui video sau fă clic dreapta pe cardul lui într-un selector de resurse și alege **Remove background…**. Un **On-device model** decupează un subiect dintr-o scenă încărcată; un **Colour key** elimină un fundal luminat uniform, precum un green screen, cu **Tolerance**, **Softness** și **Spill removal** pentru margine, și nu necesită descărcare. **Resolution** (360, 480, 720 sau 1080p, niciodată peste sursă) schimbă detaliul pe viteză. Decupajul, un WebP animat sau PNG cu transparență reală, este salvat lângă original, iar Content Credential-ul sursei merge ca ingredient. [Generat o dată, randat la fel](/info/ai-features.html) explică de ce rămâne o editare simplă.

### Ia-ți paleta și fonturile oriunde

Panoul **Swatches** din Assets arată culorile din care este făcut brandul tău: culorile de brand, culorile adăugate de tine, rampele și spectrul lui. Culorile de rol pe care Lolly le păstrează pentru interfață (text, suprafețe, margini, culorile principale ale colourway-urilor și copii ale unei culori de brand sub alt nume) așteaptă în spatele unui card gri **Show colour roles** la baza panoului.

Fiecare culoare este un card ca orice altă resursă. Fă clic pe una ca să-i deschizi detaliile, selectează câteva ca să descarci doar acelea sau descarcă întreaga paletă în formatul pe care îl citește celălalt instrument:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** sau **CSS classes**, pentru o foaie de stil sau un build. O culoare mai largă decât sRGB își păstrează valoarea largă: CSS o setează după hex, iar JSON păstrează hex-ul alături de culoarea largă, construcția CMYK și cerneala spot.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, pentru Illustrator sau Photoshop. O culoare blocată pe o construcție CMYK sosește ca acea mostră CMYK, o cerneală spot ca mostră spot cu nume, iar o culoare mai largă decât sRGB ca Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, pentru GIMP sau Inkscape, și **SCSS variables**, ambele în sRGB.

![Panoul Swatches - cele cinci butoane de descărcare a paletei sus, apoi fiecare culoare de brand ca un chip care îi deschide detaliile](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Selectează culori cu punctul de pe fiecare card: Shift-clic pe un al doilea punct pentru tot ce e între ele, trage o casetă prin goluri sau apasă Cmd/Ctrl+A cu un card în focus. Bara oferă **Download as…** în aceleași șase formate, **Copy hex** și **Favourite**. Înainte să alegi un format, meniul listează orice culoare pe care niciun format nu o poate păstra (Transparent nu are deloc culoare), ce formate salvează o culoare largă ca rezervă sRGB (SCSS și GIMP) și care poartă valorile CMYK și spot (JSON și .ase). Clic dreapta pe un card pentru aceleași acțiuni pe o singură culoare.

Detaliile unei culori umplu previzualizarea cu culoarea și desfac **Linked values** (construcția CMYK sau cerneala spot, orice valoare creată pentru un anumit spațiu sau o anumită presă și tokenul ei de design), **Every notation** (hex, OKLCH, Display-P3 și restul, fiecare cu un buton de copiere), **Plotted on a colour space**, **Tones** și **Readability**. Tastele săgeți parcurg paleta, **Copy link** partajează culoarea însăși, iar **Open in Colour Lab** o duce mai departe.

Panoul **Fonts** listează fețele de literă ale brandului tău, cu o **descărcare** pentru fiecare, ca să le instalezi local sau să le dai unei tipografii.

## Fă grila a ta

- <!--i:star--> **Pune la favorite ce folosești.** Fă clic dreapta pe un card și alege **Add to favourites**, iar primește o tilă mare într-o bandă deasupra grilei. [Favoritele tale](/info/favourites.html) acoperă banda.
- <!--i:eyeoff--> **Ascunde un instrument pe care nu-l folosești niciodată.** Fă clic dreapta pe un card sau selectează mai multe și alege **Hide tool**. Dispare din grilă și din ce găsește tastarea în grilă. O tilă gri **Show hidden tools (N)** la capăt le arată din nou, estompate, fiecare cu **Unhide tool** în meniu. Ascunderea schimbă doar grila ta: instrumentul se deschide totuși dintr-un link sau un bookmark.
- <!--i:clock--> **Instrumentele tale, primele.** După ce ai muncă salvată în trei instrumente diferite, un rând **Yours** de chip-uri deasupra grilei începe cu favoritele și instrumentele recente.
- <!--i:sliders--> **Așază-o în felul tău.** **View options** setează layoutul (**Grid**, **Card** sau **List**), dimensiunea și densitatea cardurilor, ordinea de sortare și un filtru pe categorii.

![Sfârșitul grilei Tools cu instrumentele ascunse dezvăluite: cardul Wordmark estompat și, lângă el, tila gri care l-a readus în vedere, scriind acum Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Acționează pe mai multe carduri deodată.** Bifează caseta fiecărui card, trage o casetă de selecție pe spațiu gol sau fă Shift/Cmd-clic, iar apare o bară cu ce permite acea vedere:

- **Tools și Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, arătând doar sesiunile făcute cu acele instrumente) și Copy link pentru un singur card.
- **Assets:** Favourite și Hide pentru orice selecție. Duplicate, Download și Delete apar doar când fiecare element selectat este una dintre încărcările tale, pentru că o resursă comună a sistemului de design este un contract permanent.
- **Projects:** vezi [Găsește și recuperează-ți munca](/info/find-your-work.html#find-something-you-saved).

![Bara de selecție din galerie pentru două instrumente, oferind Available offline, View sessions, Favourite și Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** apare doar după ce ceva este selectat. Fă în schimb clic dreapta pe un singur card neselectat și oferă **N saved sessions**, o listă a sesiunilor salvate ale acelui instrument, unde o ștergere mută sesiunea în Coș.

## Pe telefon

Pe un ecran îngust, layoutul devine o singură coloană:

- **Controalele devin o foaie** în partea de sus, cu un mâner de tragere pe marginea de jos. Trage mânerul ca să fixezi la **peek**, **half** sau **full** sau atinge-l ca să restrângi și să extinzi. Previzualizarea umple spațiul de dedesubt și rămâne în vedere cât editezi.
- Un buton plutitor **Export** deschide foaia de export: format, dimensiune, copiere, salvare și descărcare într-un singur loc. Atinge fundalul ca să închizi foaia.

![Un instrument pe un ecran de lățimea unui telefon - comenzile ca foaie sus, paleta generată umplând previzualizarea de dedesubt și pastila de randare plutind jos, în centru](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Setări, sunet și confort

**Settings**, la baza ecranului principal, conține detaliile tale, sistemele de design, accesibilitatea, stocarea și descărcările offline. [Settings](/info/dashboard.html) cartografiază fiecare filă.

- **Detaliile și fotografia ta** completează orice instrument făcut să le folosească, precum o semnătură de email sau un ecuson. [Profiluri](/info/profile.html) le acoperă.
- **Accessibility** are patru comutatoare de confort: **Reduce motion**, **Hide colourful previews**, **High contrast** și **Large text**. Ele schimbă aplicația din jurul muncii tale, niciodată canvasul unui instrument sau un export.
- **Sound** redă sunete blânde de asistență pentru ce faci, iar **Neurospicy Mode** redă o piesă calmă de concentrare. Ambele sunt oprite până le pornești, în **Settings → Accessibility** sau în meniul profilului.
- **Available offline** descarcă restul aplicației, instrumentele, catalogul și ghidurile înainte să pierzi conexiunea. Lolly este o aplicație web pe care o poți instala: folosește butonul de instalare al browserului sau *Add to Home Screen* pe telefon, pentru o aplicație pe tot ecranul care se actualizează singură când ești din nou online.
- **Storage** arată ce păstrează Lolly pe acest dispozitiv. [Dacă ștergi datele browserului](/info/find-your-work.html#if-you-clear-your-browser-data) explică ce elimină ștergerea, iar [Politica de confidențialitate](/info/privacy.html) listează tot ce preia sau trimite aplicația.

::: note Dacă o vedere nu se încarcă după o actualizare
Un panou gol sau un mesaj „failed to fetch” imediat după o actualizare se rezolvă de obicei cu o singură reîncărcare. Munca salvată, sesiunile și sistemele tale de design nu sunt afectate, pentru că sunt stocate pe dispozitivul tău. Doar o imagine adăugată și nesalvată ar putea trebui adăugată din nou.
:::

## Ce urmează

- **[Design: canvasul liber](/info/design.html)**: canvasul, formele, cronologia și prezentarea unui deck.
- **[Batch și Multi-edit](/info/batch.html)**: multe versiuni ale unui design sau mai multe designuri salvate editate împreună.
- **[Exportă un fișier](/info/exporting.html)**: alegerea unui format, dimensiune, unități de tipar, transparență și video.
- **[Importă un design](/info/design-import.html)**: adu un fișier Figma, Penpot, Illustrator sau InDesign în Design și continuă să editezi.
- **[Șabloane](/info/templates.html)**: puncte de pornire salvate pentru un instrument.
- **[Culoare largă și HDR](/info/hdr-editing.html)**: păstrează precizia originală a imaginii în Design și Darkroom.
- **[Găsește și recuperează-ți munca](/info/find-your-work.html)**: unde este totul și cum îl muți pe alt dispozitiv.
