# Găsește și recuperează-ți lucrarea

Lipsește ceva: un design pe care nu l-ai salvat, un fișier descărcat, versiunea de săptămâna trecută sau tot după ștergerea browserului. Începe cu tabelul, apoi urmează secțiunea la care trimite.

Munca personală rămâne în browserul sau aplicația în care ai făcut-o, pe acel dispozitiv, dacă nu activezi [Sync](/info/sync.html). O organizație care folosește Lolly Work opțional păstrează și **Team projects** pe serverul ei, acoperite mai jos.

| Ce ai făcut | Unde te uiți |
|---|---|
| Ai apăsat **Salvează ca** sau **Salvează** | **Proiecte** |
| Ai apăsat **Descarcă** | Descărcările browserului tău, și o copie în **Resurse** |
| Niciuna, într-un [instrument care salvează pe măsură ce lucrezi](#which-tools-save-as-you-work) | **Proiecte** și **Istoric** |
| Niciuna, în orice alt instrument | Doar fila în care ai lucrat, până o închizi |
| L-ai șters în aplicație | **Coș de gunoi**, în **Proiecte**, **Resurse** sau **Setări → Stocare**, timp de 30 de zile |

::: figure find-your-work-places
Unde trăiește munca ta: stocarea proprie a browserului conține Projects, History și Trash; descărcările merg în dosarele dispozitivului tău; Sync și un fișier de backup sunt copiile din afara browserului.
:::

::: details Găsește munca comună în Lolly Work (opțional)
Deschide Lolly-ul organizației tale și autentifică-te, apoi uită-te în **Projects → Team projects**. Sesiunile comune sunt ținute de acea instanță și apar după accesul tău. Autentificarea poate restaura accesul la acele sesiuni pe alt dispozitiv; nu restaurează biblioteca ta personală sau backup-ul dispozitivului.

Într-un [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional), așteaptă **Saved to work** înainte să pleci. Dacă lipsește un proiect comun, verifică dacă ești conectat la instanța potrivită și întreabă operatorul ei despre acces sau păstrare. Ștergerea datelor browserului elimină copiile locale, nu copia de pe serverul organizației. Vezi [Folosește Lolly în organizația ta](/info/organisation.html).
:::

## Găsește ceva ce ai salvat

1. Apasă **Acasă** din stânga sus a instrumentului.
2. Deschide fila **Proiecte** din partea de sus a ecranului principal (pictograma de folder pe telefon).
3. Uită-te pe primul ecran. Lucrarea salvată în **Biblioteca mea** e acolo, iar fiecare proiect e un folder. Ca să cauți în toate folderele deodată, tastează în **Caută în toate proiectele…** de la baza ecranului.

Un element este denumit după numele de fișier tastat în panoul de export sau, dacă nu ai tastat unul, după instrumentul lui, precum **QR Code**. Deschide elementul și fiecare setare este înapoi, gata de schimbat și exportat din nou. Ca să păstrezi munca nouă astfel, vezi [Salvare și continuare](/info/using.html#saving-continuing).

::: note Nu e în Proiecte?
- S-ar putea să fie în **Coș de gunoi**: vezi [Recuperează ceva ce ai șters](#get-back-something-you-deleted).
- Alt browser, o fereastră privată sau alt dispozitiv pornesc goale, decât dacă folosești [Sync](/info/sync.html) sau [îți muți lucrarea](#move-your-work-to-another-device).
- Dacă ai apăsat doar **Descarcă**, vezi [Găsește un fișier pe care l-ai descărcat](#find-a-file-you-downloaded).
:::

::: details Lucrul cu Proiecte
Poți deschide **Proiecte** și din **Setări → Stocare → Sesiuni salvate → Organizează în proiecte**. Funcționează ca un manager de fișiere:

![Proiecte înainte să fie salvat ceva: dalele Folder nou, Element nou și Șabloane, ceasul History din dreapta sus și bara Caută în toate proiectele din partea de jos](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Dosare imbricate.** Grupează sesiunile salvate în dosare și dosarele în dosare, cât de adânc vrei. Creează un dosar, redenumește-l sau trage o tilă pe alt dosar ca s-o muți; un breadcrumb te readuce sus. Sesiunile salvate fără dosar apar direct la rădăcina **Projects**.
- <!--i:clock--> **Sortează în felul tău.** **View options**, butonul cu glisoare din dreapta sus, oferă **Grid** sau **List** și sortează după **Name**, **Date added**, **Last modified** (implicit), **Size** și, într-un dosar, **By tool**. Dosarele vin mereu primele indiferent de sortarea activă - sortarea ordonează doar sesiunile și dosarele din propriul grup.
- <!--i:document--> **Pune munca nouă direct la loc.** **New asset** deschide selectorul comun. Alege **Templates** ca să pornești de la un șablon salvat: deschide-l pentru editare sau folosește **+ Add** ca să salvezi imediat o creație nouă.
- <!--i:checklist--> **Selecție multiplă (desktop).** Bifează caseta unei tile, trage o casetă de selecție pe spațiu gol sau **Shift/Cmd-clic**; **clic dreapta** pe o tilă pentru meniul contextual. Bara de selecție oferă apoi **Render selection**, **Move to…**, **New folder**, **Delete** (care mută în Trash), **Edit together** pentru două până la opt sesiuni cu un singur instrument, una lângă alta sub o singură bară laterală, și **Edit as sheet**, care deschide o selecție de orice dimensiune sau amestec ca rânduri în grila batch.
- <!--i:download--> **Randează un dosar întreg sau o selecție.** **Render folder** exportă fiecare sesiune salvată dintr-un dosar - inclusiv subdosarele - ca un singur `.zip` imbricat. **Render selection** face același lucru pentru orice selecție multiplă, iar o singură sesiune se randează direct în propriul fișier.
- <!--i:link--> **Sari direct la munca salvată a unui instrument.** Bifează unul sau mai multe instrumente în galeria Tools și alege **View sessions** din bara de selecție - Projects se deschide arătând doar sesiunile făcute cu acele instrumente, cu un **Clear** pentru a reveni la vederea completă.
- <!--i:link--> **Partajează o sesiune salvată.** Fă clic dreapta pe o sesiune (pe telefon, apasă **•••** pe tila ei) → **Share link** pentru a copia un link care o redeschide cu aceleași setări; imaginile de pe dispozitivul tău nu călătoresc cu un link (dialogul Share complet: vezi [Partajarea muncii tale](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Redenumește sau copiază una.** Fă clic dreapta pe o sesiune (pe telefon, apasă **•••** pe tila ei) pentru **Rename**, **Duplicate** (o copie în același dosar) și **Move to…**.

![Popover-ul Opțiuni de vizualizare din Proiecte: Aspect cu Grilă și Listă, și Sortează după setat la Ultima modificare, lângă un buton care inversează ordinea](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## Dacă ai închis fila sau ai părăsit instrumentul

Ce revine depinde de cum ai plecat și ce instrument ai folosit:

- **Ai închis fila sau ai revenit altă dată.** Munca nesalvată a dispărut, cu excepția [instrumentelor care salvează pe măsură ce lucrezi](#which-tools-save-as-you-work): deschide acea muncă din **Projects**.
- **Ai reîncărcat pagina în aceeași filă.** Setările tale revin din adresa paginii. În instrumentele care nu salvează pe măsură ce lucrezi, imaginile și fișierele adăugate de pe dispozitiv și textul pe un rând mai lung de 150 de caractere nu revin, pentru că adresa nu le conține.
- **Ai apăsat Home sau butonul înapoi din stânga sus.** Dacă ai schimbat ceva de la ultima salvare, descărcare sau copiere, un dialog **Unsaved edits** întreabă dacă să salvezi mai întâi. **Save & leave** salvează munca și te duce în **Projects** sau înapoi în dosarul de proiect din care ai deschis munca. **Leave anyway** renunță la modificări: un element salvat revine la cum l-ai salvat ultima dată, iar o creație pe care nu ai salvat-o părăsește **Projects**. **Cancel** te păstrează în instrument.

Lolly întreabă doar când apeși **Acasă** sau butonul de înapoi într-un instrument. Închiderea filei, reîncărcarea și butonul propriu de înapoi al browserului tău nu întreabă niciodată. Ca să fii sigur, apasă **Salvează ca**, sau **Salvează** din panoul de export, înainte să părăsești un instrument.

Când recuperarea automată nu este disponibilă, o notă de lângă controalele de editare spune ce să păstrezi:

- Într-un instrument care lucrează pe un fișier pe care îl aduci, salvează-ți setările și păstrează și fișierele originale.
- Într-un instrument de înregistrare sau un utilitar fără acțiunea Save, salvează sau descarcă rezultatul înainte să pleci.
- Aplicațiile desktop și mobile spun când trebuie să salvezi manual.
- Într-un collab privat, persoana care a invitat păstrează documentul și istoricul lui, inclusiv modificările celeilalte persoane. Persoana care s-a alăturat lucrează pe o copie temporară și ar trebui să salveze o copie separată înainte să se termine sesiunea.

::: note Ai plecat fără să salvezi din greșeală?
În instrumentele care salvează pe măsură ce lucrezi, Istoricul păstrează o copie a modificărilor abandonate. Deschide pagina **Istoric**, găsește-le sub **Changes** și apasă **Deschide ca o copie**. În celelalte instrumente, modificările s-au pierdut.
:::

::: details Ce instrumente salvează pe măsură ce lucrezi
În aplicația web, fiecare instrument care produce un document salvează pe măsură ce lucrezi: Design, Chart, QR Code, Text, Sandbox și restul. Acestea nu salvează:

- instrumentele care lucrează pe un fișier adus de tine, precum Redact, Sign sau Convert Image, pentru că Lolly nu păstrează niciodată o copie a acelui fișier;
- instrumentele care înregistrează de la camera, microfonul sau ecranul tău, precum Record, Screen Capture și Voice Recorder;
- un instrument fără nimic de schimbat, precum Countdown.

În celelalte instrumente, prima ta schimbare arhivează munca în **Projects** ca și cum ai fi salvat, iar schimbările ulterioare sunt păstrate pe măsură ce lucrezi, odată ce instrumentul a terminat de desenat. O creație nesalvată este tot în Projects după ce închizi fila și se redeschide cu modificările marcate ca nesalvate.

**Leave anyway** renunță totuși la acele modificări, iar History păstrează 30 de zile o copie a editărilor aruncate. Redeschiderea instrumentului de pe ecranul principal începe o creație nouă; deschide-o pe cea anterioară din Projects.

3D și Darkroom salvează pe măsură ce lucrezi, dar nu păstrează un fișier încărcat în ele, precum un model 3D sau un LUT. History și **Save** păstrează numele, tipul și dimensiunea fișierului, nu fișierul. Când redeschizi munca, o notă spune ce fișier a fost, iar instrumentul funcționează fără el până îl încarci din nou. Păstrează-ți fișierele originale.

Cu [Sync](/info/sync.html) activat, o creație depusă astfel ajunge pe celelalte dispozitive ale tale ca orice altceva din Proiecte. Versiunile ei rămân pe dispozitivul pe care au fost făcute.

Dacă o creație este deschisă în două file și salvezi în ambele, este păstrată ultima salvare. Lucrarea pe care a înlocuit-o nu se pierde: se află sub **Ciorne protejate**, în Istoricul creației, cu **Deschide ciorna ca o copie**.

Asta funcționează doar în aplicația web, nu în aplicațiile desktop sau mobile, și nu cât timp lucrezi live cu altcineva.
:::

## Găsește un fișier pe care l-ai descărcat

Într-un browser, **Descarcă** predă fișierul browserului tău, care îl salvează în folderul lui de descărcări (de obicei **Downloads**) sau te întreabă unde. Lolly nu e informat unde a ajuns fișierul, așa că uită-te în lista de descărcări a browserului tău.

Dacă n-a apărut niciun fișier, uită-te în panoul de export cât încă ești în instrument. Sub **Descarcă**, un rând dă numele fișierului și ora, cu **Retry download**, iar în Chrome, Edge și alte browsere Chromium, **Save file…** ca să alegi tu însuți un folder. Rândul și fișierul lui durează până când părăsești instrumentul, reîncarci sau exporți din nou.

Lolly mai păstrează și două lucruri după fiecare descărcare:

- **O copie a fișierului**, în **Resurse** sub **Încărcările tale**, cât timp **Salvează randările mele în biblioteca mea** e activat sub **Setări → Randările tale** (**Setări** e la baza ecranului principal). Setarea pornește activată. Un video, sau un fișier de peste 50 MB, întreabă întâi, iar o arhivă zip nu e copiată.
- **Setările pe care le-ai folosit**, pentru ultimele tale 24 de descărcări. **Exporturi recente**, sub lucrarea ta salvată din **Proiecte**, redeschide instrumentul cu acele setări ca să poți face din nou fișierul, deși fotografiile și fișierele pe care le-ai adăugat de pe dispozitivul tău nu sunt incluse. Aceeași listă e sub **Setări → Activitate & statistici → Ultimele exporturi** și pe fila **Changes** din **History**. Lista asta păstrează setări, nu fișiere.

::: details În aplicațiile desktop și mobile
- **Aplicația desktop:** **Descarcă** salvează direct într-un folder **Lolly** din interiorul folderului tău **Downloads**, fără niciun dialog. Rândul de sub **Descarcă** spune unde a ajuns, ceva de genul „Salvat la Downloads/Lolly”, împreună cu **Arată în folder**. **Open Exports Folder**, din meniul **Window** sau **Exports**, deschide folderul oricând. Un fișier cu același nume ca unul anterior e salvat ca „name (1)”.
- **iPhone și iPad:** fișierul e salvat în aplicația **Fișiere**, sub **Lolly**, iar foaia de partajare se deschide ca să-l poți trimite mai departe. Rândul de sub **Descarcă** spune „Salvat la Fișiere → Lolly”.
- **Android:** meniul de partajare se deschide ca să alegi unde merge fișierul.

Pe iPhone, iPad și Android, un fișier nou îl înlocuiește pe unul anterior cu același nume.
:::

## Revino la o versiune anterioară

- **În timpul acestei vizite:** **Anulează** dă înapoi prin ultimele tale 100 de modificări, până când părăsești instrumentul sau reîncarci. Vezi [Anulare și refacere](/info/using.html#undo-and-redo).
- **În [instrumentele care salvează pe măsură ce lucrezi](#which-tools-save-as-you-work):** versiunile anterioare ale fiecărei creații sunt păstrate. Urmează pașii de mai jos.
- **Tot ce e pe dispozitiv:** cu [Sync](/info/sync.html) activat, **Restore an earlier copy**, sub **Setări → Servicii conectate**, aduce înapoi una dintre ultimele șapte copii zilnice, sau copia dinainte de ultima ta aplicare. Tot ce e pe dispozitivul ăsta se potrivește apoi cu acea copie, nu doar un design.

Ca să deschizi o versiune anterioară:

1. Apasă **Istoric**, butonul cu ceas de lângă **Anulează** și **Refă**. În Design, **Istoric** este în bara de sus; pe telefon, apasă **•••** și apoi **Istoric**. În instrumentele fără **Anulează**, cum ar fi Text și Sandbox, **Istoric** este lângă **Acasă**, în stânga sus.
2. Găsește versiunea după data și ora ei. Rândurile **Punct de control automat** sunt luate pe măsură ce lucrezi; rândurile **Versiune salvată** sunt momentele în care ai salvat.
3. Apasă **Deschide ca o copie**. Versiunea se deschide ca o creație nouă, iar cea pe care o aveai deschisă rămâne așa cum era. Copia e în **Proiecte**, cu „(copy)” după numele ei.

Ca să păstrezi o versiune după nume, apasă **Name version**, tastează un nume și apasă **Keep milestone**. Versiunile numite sunt listate pe pagina **History**, sub **Milestones**.

::: details Panoul History și pagina History
Panoul **History** mai listează și rânduri **Recovered work**, iar **Protected drafts** păstrează ultimele tale modificări dintre puncte de control, cu **Open draft as a copy**. **Compare** și **Check assets** te ajută să alegi înainte să deschizi o copie. Comută **This creation** pe **All history on this device** ca să vezi fiecare creație.

Punctele de control automate se răresc odată cu vechimea: unul pe minut în ultima oră, unul pe oră în ultima zi, unul pe zi timp de 30 de zile, apoi unul pe săptămână. Versiunile salvate și versiunile denumite sunt păstrate toate. Ștergerea unei creații îi mută și versiunile în **Coș de gunoi**, iar **Șterge definitiv** le elimină.

Când stocarea Istoricului se umple, primele eliminate sunt cele mai vechi puncte de control automate ale creațiilor pe care nu le-ai deschis de 30 de zile. O salvare este întotdeauna păstrată, chiar și atunci: este scrisă ca lucrarea curentă, iar Istoricul spune că această salvare nu este păstrată ca versiune. **Setări → Stocare** arată cât spațiu folosește Istoricul.

Pagina **History** (`#/history`) acoperă fiecare creație din acest browser. Ca s-o deschizi, apasă butonul cu ceas din dreapta sus al ecranului principal sau al **Projects**, alege **Saved sessions** în meniul profilului (pe telefon, butonul rotund cu logo din dreapta sus) sau apasă **Open app history** în panoul History al unui instrument. Aplicațiile desktop și mobile nu au pagină History, deci acolo butonul cu ceas al ecranului principal și **Saved sessions** deschid în schimb **Your recent work**: cele mai recente sesiuni salvate și exporturi, cu un link spre Projects.

- **Recente** listează creațiile tale, cele mai noi primele, cu **Continuă**.
- **Changes** pune punctele de control, descărcările și rezultatele Convert pe o singură cronologie. O descărcare are **Reopen settings**.
- **Milestones** listează versiunile numite.

Filtrează după proiect, instrument și dată (sub **Filters** pe telefon). Pagina History n-are buton de ștergere; ca să elimini un element, folosește Proiecte.
:::

## Mută-ți lucrarea pe alt dispozitiv

| Ca să | Folosește |
|---|---|
| Îți ții dispozitivele sincronizate | **Sincronizare între dispozitive**, sub **Setări → Servicii conectate**: vezi [Sincronizează-ți dispozitivele](/info/sync.html) |
| Muți totul o singură dată | **Exportă datele mele** și **Importă date…**, mai jos |
| Predai un design sau un proiect | Un fișier `.lolly`: **Exportă**, apoi **Distribuie**, apoi **Download .lolly**; pentru un proiect întreg, **Download project (.lolly)** din meniul folderului. Apasă **Deschide** pe celălalt dispozitiv. Vezi [Fișierul .lolly](/info/using.html#the-lolly-file) |

Un link de partajare duce mai departe setările tale, dar nu și fotografiile sau fișierele pe care le-ai adăugat de pe dispozitivul tău.

::: note Importul adaugă, dar nu șterge nimic
Folderele, favoritele și șabloanele din fișier sunt adăugate alături de cele deja existente pe celălalt dispozitiv. Când un element salvat există pe ambele, este păstrată copia salvată mai recent. Detaliile și setările tale de pe acel dispozitiv rămân așa cum sunt; cele goale sunt completate din fișier. **Bring it to this device**, din Sync, funcționează la fel.
:::

Ca să muți totul o singură dată:

1. Pe dispozitivul vechi, deschide **Setări → Stocare** și, sub **Mută pe alt dispozitiv**, apasă **Exportă datele mele**. Lolly descarcă un singur fișier `.zip` al cărui nume începe cu `LollyTools-`.
2. Cară fișierul peste prin USB, e-mail către tine însuți, AirDrop sau un folder partajat.
3. Pe dispozitivul nou, deschide **Setări → Stocare**, apasă **Importă date…**, alege fișierul și apasă **Importă**.

::: note Ce rămâne în urmă
Autentificările, cheile și fraza de acces pentru sincronizare rămân pe fiecare dispozitiv. Lista descărcărilor recente, descărcările offline și modelele AI nu călătoresc pe nicio cale. Istoricul versiunilor călătorește doar într-un fișier **Exportă datele mele**, nu prin Sync sau printr-un `.lolly`. Când istoricul este prea mare pentru un singur fișier, cele mai vechi puncte de control automate sunt omise, iar linia de export spune câte. O copie pe care Sync o ține în stocarea ta poate fi descărcată și deschisă, sau aleasă din **Importă date…**, ca un fișier de backup; o copie criptată îți cere fraza de acces.
:::

::: details Ce conține fișierul de rezervă
Fișierul e numit `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (părțile numelui vin din profilul tău și sunt omise dacă nu sunt setate; `<n>` e un contor zilnic ca exporturile din aceeași zi să nu se suprapună). Conține profilul tău, cu folderele, coșul de gunoi, șabloanele și favoritele tale; fiecare sesiune salvată cu miniatura ei; imaginile, fonturile, logourile încărcate și copiile descărcărilor tale; sistemele tale de design; preferințele tale (temă, lățimea barei laterale, statistici locale de activitate); versiunile salvate și rezultatele din Convert; și, din aplicația web, istoricul versiunilor creațiilor tale.

Cache-ul catalogului nu este inclus - se descarcă singur din nou pe noul dispozitiv. Fiecare parte are sumă de control, deci un fișier deteriorat în tranzit este prins la import, nu restaurat pe jumătate stricat. Sesiunile salvate se relegă automat la imaginile tale importate. Aplicațiile web, desktop și mobile citesc același fișier; aplicația de terminal scrie un backup mai simplu al ei, pe care acest format nu îl citește. **Export my data & render everything** face același fișier plus un al doilea zip cu fiecare sesiune salvată randată în ieșirea ei. (Specificația completă a formatului: [Transferul de date](/info/data-transfer.html).)
:::

## Dacă îți ștergi datele de browser

În aplicația web, Lolly păstrează totul în stocarea browserului tău pentru acest site: lucrări salvate, fotografii, fonturi, sisteme de design, istoric de versiuni și descărcări offline. Ștergerea datelor acestui site din browserul tău elimină tot ce e mai sus, iar Lolly nu poate aduce înapoi nimic din ele. Ce rămâne e ce a părăsit deja browserul: fișierele pe care le-ai descărcat, un fișier **Exportă datele mele**, o copie [Sync](/info/sync.html) și linkurile pe care le-ai partajat.

::: warning Înainte să-ți ștergi datele de browser
Apasă **Exportă datele mele** sub **Setări → Stocare**, și păstrează fișierul altundeva.
:::

Când pornește aplicația, Lolly cere browserului să nu-și șteargă stocarea când dispozitivul rămâne fără spațiu, iar browserul decide. În **Settings → Available offline**, o linie care începe cu **Protected** înseamnă că browserul a fost de acord. „The browser may clear downloads if the device runs low on space” înseamnă că nu, iar **Protect downloads** cere din nou.

Dacă browserul nu a fost de acord, poate șterge munca salvată și descărcările când spațiul se termină, deci păstrează un fișier **Export my data** recent.

**Setări → Stocare** arată cât spațiu folosește fiecare tip de date. Rândul ei **Istoric** numără punctele de control automate, previzualizările lor și ciornele de recuperare; **Elimină punctele de control automate mai vechi de 30 de zile** eliberează acel spațiu și păstrează versiunile salvate și cele denumite. **Golește cache-ul** elimină fișierele de catalog descărcate, care se descarcă din nou când e nevoie. **Șterge toate datele mele** îți cere să tastezi un cuvânt, oprește Sync, apoi elimină tot ce păstrează Lolly în acest browser: profilul și setările tale, sesiunile salvate împreună cu istoricul lor și Coșul de gunoi, încărcările, fonturile și sistemele de design, jurnalul de descărcări, rezultatele Convert, modelele AI descărcate și copiile offline. Fișierele pe care le-ai descărcat rămân unde le-ai salvat. Aplicația pornește apoi ca la prima vizită.

![Cardul de stocare pe un ecran de lățime telefon: fiecare categorie de date de pe dispozitiv este numită, cu butonul Clear all my data jos](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

În aplicațiile desktop și mobile, sesiunile salvate sunt fișiere în propriul folder de date al aplicației, iar restul e în stocarea proprie a aplicației, așa că ștergerea unui browser web nu le atinge.

::: details Unde păstrează aplicațiile desktop și mobile sesiunile salvate
Un fișier pentru fiecare sesiune salvată, într-un folder `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, sau aceeași cale sub `$XDG_DATA_HOME`
- iPhone, iPad și Android: în interiorul stocării proprii a aplicației, pe care aplicația Fișiere n-o arată

Fotografiile, sistemele de design și lista descărcărilor recente rămân în stocarea internă a aplicației, nu în aceste foldere. Aplicația de terminal și linia de comandă citesc același folder `saved-state`: vezi [Unde trăiesc sesiunile salvate](/info/cli-reference.html#where-saved-sessions-live).
:::

## Recuperează ceva ce ai șters

Ștergerea unei sesiuni salvate, a unui folder, a uneia dintre încărcările tale sau a unuia dintre fonturile tale în aplicație o mută în **Coș de gunoi** timp de 30 de zile, indiferent de unde o ștergi: **Proiecte**, **Resurse**, **Setări → Stocare** sau lista de sesiuni salvate a unui instrument. Un folder pleacă împreună cu tot ce conține, ca o singură intrare, iar o sesiune își păstrează istoricul de versiuni cât timp se află acolo. Imediat după, un mesaj oferă **Anulează**. Mai târziu:

1. Deschide **Coș de gunoi**: dala **Coș de gunoi** din **Proiecte**, butonul **Coș de gunoi** din **Resurse → Încărcările tale**, sau rândul **Coș de gunoi** din **Setări → Stocare**. Toate trei deschid aceeași listă.
2. Apasă **Restaurează** lângă element. Se întoarce în folderul lui, iar un font își recapătă rolurile pe care le avea în sistemul lui de design.

**Șterge definitiv** elimină un element pentru totdeauna. **Golește coșul de gunoi** întreabă întâi, apoi elimină fiecare element din Coșul de gunoi. Elementele mai vechi de 30 de zile sunt eliminate definitiv.

::: warning Unele ștergeri sunt imediate
Ștergerea unui sistem de design, a unui logo sau a fotografiei tale de profil nu ajunge în Coșul de gunoi. Linia de comandă și aplicația de terminal șterg și ele pe loc.
:::

Cu [Sync](/info/sync.html) activat, **Restore an earlier copy** poate aduce înapoi starea dintr-o zi anterioară a întregului dispozitiv, iar un fișier **Exportă datele mele** aduce înapoi ce conține fișierul.
