# Găsește și recuperează-ți munca

Găsește un design pe care nu l-ai salvat niciodată, un fișier descărcat, versiunea de săptămâna trecută sau munca ta după ștergerea datelor browserului. Începe cu tabelul.

Munca personală rămâne în browserul sau aplicația în care ai creat-o, pe acel dispozitiv, dacă nu activezi [Sync](/info/sync.html). O organizație care folosește opțional Lolly Work păstrează și **Team projects** pe serverul ei.

| Ce ai făcut | Unde să cauți |
|---|---|
| Ai apăsat **Save as** sau **Save** | **Projects** |
| Ai apăsat **Download** | Descărcările browserului și o copie în **Assets** |
| Niciuna, într-un [instrument care salvează pe măsură ce lucrezi](#which-tools-save-as-you-work) | **Projects** și **History** |
| Niciuna, într-un instrument care nu face asta | Doar fila în care ai lucrat, până o închizi |
| Ai șters elementul în aplicație | **Trash**, în **Projects**, **Assets** sau **Settings → Storage**, timp de 30 de zile |

::: figure find-your-work-places
Unde se află munca ta: stocarea proprie a browserului conține Projects, History și Trash; descărcările ajung în folderele dispozitivului; Sync și un fișier de rezervă sunt copiile din afara browserului.
:::

::: details Găsește munca partajată în Lolly Work (opțional)
Deschide Lolly al organizației tale, conectează-te și caută în **Projects → Team projects**. Acea instanță conține sesiuni partajate și le arată pe cele la care ai acces. Conectarea de pe alt dispozitiv poate restabili accesul la acele sesiuni. Conectarea nu restabilește biblioteca personală sau copia de siguranță a dispozitivului.

Într-o [colaborare prin Work](/info/collaborate.html#collabs-through-lolly-work-optional), așteaptă **Saved to work** înainte să pleci. Dacă lipsește un proiect partajat, verifică dacă ești conectat la instanța potrivită și întreabă operatorul ei despre acces sau păstrarea datelor. Ștergerea datelor browserului elimină copiile locale, nu copia de pe serverul organizației. Vezi [Folosește Lolly în organizația ta](/info/organisation.html).
:::

<!--i:eti-search-->
## Găsește ceva ce ai salvat

1. Apasă **Home** în colțul din stânga sus al instrumentului.
2. Deschide fila **Projects** din partea de sus a ecranului principal (pictograma folder pe telefon).
3. Tot ce ai salvat în **My library** se află pe primul ecran. Fiecare proiect este un folder. Ca să cauți în toate folderele, scrie în **Search all projects…** în partea de jos a ecranului.

Un element primește numele de fișier pe care l-ai scris în panoul de export. Fără un nume de fișier, primește numele instrumentului lui, precum **QR Code**. Deschiderea elementului restabilește fiecare setare. Ca să salvezi ceva nou, vezi [Salvare & continuare](/info/using.html#saving-continuing).

::: note Nu apare în Projects?
- Poate fi în **Trash**: vezi [Recuperează ceva ce ai șters](#get-back-something-you-deleted).
- Un alt browser, o fereastră privată sau un alt dispozitiv pornește fără conținut, dacă nu folosești [Sync](/info/sync.html) sau nu [îți muți munca](#move-your-work-to-another-device).
- Dacă ai apăsat doar **Download**, vezi [Găsește un fișier descărcat](#find-a-file-you-downloaded).
:::

::: details Lucrul cu Projects
Poți deschide vizualizarea **Projects** și din **Settings → Storage → Saved sessions → Organise in Projects**. Funcționează ca un manager de fișiere:

![Projects înainte să salvezi ceva: cardurile New folder, New asset și Templates, ceasul History din dreapta sus și bara Search all projects din partea de jos](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Foldere imbricate.** Pune sesiuni salvate în foldere și foldere în alte foldere, la orice adâncime. Creează sau redenumește un folder ori trage un card pe un folder ca să muți cardul. Calea de navigare te duce înapoi la nivelurile superioare. Sesiunile salvate fără folder se află la rădăcina **Projects**.
- <!--i:clock--> **Sortează cum vrei.** **View options**, butonul cu glisoare din dreapta sus, oferă **Grid** sau **List** și sortează după **Name**, **Date added**, **Last modified** (implicit), **Size** și, într-un folder, **By tool**. Folderele apar mereu primele. Sesiunile și folderele sunt sortate fiecare în propriul grup.
- <!--i:document--> **Pune munca nouă direct la locul ei.** **New asset** deschide selectorul comun. Alege **Templates** ca să pornești de la un șablon salvat. Deschide șablonul ca să-l editezi sau apasă **+ Add** ca să salvezi imediat o creație nouă.
- <!--i:checklist--> **Selecție multiplă (desktop).** Bifează caseta unui card, trasează un dreptunghi de selecție pe spațiul liber sau folosește **Shift/Cmd-click**. Pentru meniul contextual al unui card, fă **clic dreapta** pe card. Bara de selecție oferă **Render selection**, **Move to…**, **New folder** și **Delete** (în Trash). **Edit together** deschide între două și opt sesiuni cu câte un singur instrument, una lângă alta, cu o singură bară laterală. **Edit as sheet** deschide o selecție de orice dimensiune sau combinație ca rânduri în grila pentru loturi.
- <!--i:download--> **Randează un folder întreg sau o selecție.** **Render folder** exportă fiecare sesiune salvată dintr-un folder și subfolderele lui într-un singur `.zip` cu aceeași structură. **Render selection** face același lucru pentru o selecție multiplă. O singură sesiune se randează în propriul fișier.
- <!--i:link--> **Mergi direct la munca salvată a unui instrument.** Bifează unul sau mai multe instrumente în galeria Tools și alege **View sessions** din bara de selecție. Projects arată apoi doar sesiunile create cu acele instrumente. **Clear** restabilește vizualizarea completă.
- <!--i:link--> **Partajează o sesiune salvată.** Fă clic dreapta pe o sesiune (pe telefon, apasă **•••** pe cardul ei) și alege **Share link**. Linkul redeschide sesiunea cu aceleași setări. Imaginile de pe dispozitivul tău nu sunt incluse într-un link. Pentru dialogul Share complet, vezi [Partajarea muncii tale](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Redenumește sau copiază o sesiune.** Același meniu conține **Rename**, **Duplicate** (o copie în același folder) și **Move to…**.

![Panoul View options din Projects: Layout cu Grid și List și Sort by setat la Last modified, lângă un buton care inversează ordinea](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

<!--i:eti-refresh-->
## Dacă ai închis fila sau ai părăsit instrumentul

Ce se restabilește depinde de cum ai plecat și de instrument:

- **Ai închis fila sau ai revenit altă dată.** Munca nesalvată s-a pierdut, cu excepția [instrumentelor care salvează pe măsură ce lucrezi](#which-tools-save-as-you-work). Deschide acea muncă din **Projects**.
- **Ai reîncărcat pagina în aceeași filă.** Setările tale se restabilesc din adresa paginii. În instrumentele care nu salvează pe măsură ce lucrezi, adresa nu conține imaginile și fișierele de pe dispozitivul tău sau textul pe o singură linie mai lung de 150 de caractere, așa că acestea nu se restabilesc.
- **Ai apăsat Home sau butonul Înapoi din stânga sus.** Dacă ai schimbat ceva de la ultima salvare, descărcare sau copiere, un dialog **Unsaved edits** te întreabă dacă vrei să salvezi mai întâi. **Save & leave** salvează munca și te duce în **Projects** sau înapoi în folderul proiectului din care ai deschis-o. **Leave anyway** renunță la modificări. Un element salvat revine la ultima salvare, iar o creație pe care nu ai salvat-o niciodată dispare din **Projects**. **Cancel** te păstrează în instrument.

::: warning Închiderea filei nu cere confirmare
Închiderea filei, reîncărcarea și butonul Înapoi al browserului nu cer niciodată confirmare. Ca să fii sigur, apasă **Save as** sau **Save** în panoul de export înainte să părăsești un instrument.
:::

Când recuperarea automată nu este disponibilă, o notă lângă controalele de editare spune ce să păstrezi:

- Într-un instrument care lucrează pe un fișier adus de tine, salvează setările și păstrează și fișierele originale.
- Într-un instrument de înregistrare sau un utilitar fără acțiunea Save, salvează sau descarcă rezultatul înainte să pleci.
- Aplicațiile desktop și mobile îți spun când trebuie să salvezi manual.
- Într-o colaborare privată, persoana care a trimis invitația păstrează documentul și istoricul lui, inclusiv modificările celeilalte persoane. Persoana care s-a alăturat lucrează pe o copie temporară și ar trebui să salveze o copie separată înainte să se încheie sesiunea.

::: note Ai plecat din greșeală fără să salvezi?
În instrumentele care salvează pe măsură ce lucrezi, History păstrează o copie a modificărilor abandonate timp de 30 de zile. Deschide pagina **History**, găsește-le în **Changes** și apasă **Open as a copy**. În celelalte instrumente, modificările s-au pierdut.
:::

::: details Ce instrumente salvează pe măsură ce lucrezi
În aplicația web, fiecare instrument care creează un document salvează pe măsură ce lucrezi, precum Lolly Design, Lolly Chart, QR Code, Text și Lolly Sandbox. Aceste instrumente nu fac asta:

- instrumentele care lucrează pe un fișier adus de tine, precum Redact, Sign sau Convert Image, deoarece Lolly nu păstrează niciodată o copie a acelui fișier;
- instrumentele care înregistrează de la cameră, microfon sau ecran, precum Record, Lolly Screen Capture și Lolly Voice Recorder;
- un instrument în care nu ai nimic de schimbat, precum Countdown.

În celelalte instrumente, prima modificare pune munca în **Projects** ca și cum ai fi salvat-o. Modificările ulterioare sunt păstrate după ce instrumentul termină de desenat. O creație nesalvată rămâne în Projects după ce închizi fila și se redeschide cu modificările marcate ca nesalvate.

**Leave anyway** renunță în continuare la acele modificări. Deschiderea din nou a instrumentului din ecranul principal începe o creație nouă; deschide-o pe cea anterioară din Projects.

3D și Lolly Darkroom salvează pe măsură ce lucrezi, dar nu păstrează un fișier pe care îl încarci în ele, precum un model 3D sau un LUT. History și **Save** păstrează numele, tipul și dimensiunea fișierului, nu fișierul. Când redeschizi munca, o notă indică fișierul, iar instrumentul funcționează fără el până îl încarci din nou. Păstrează fișierele originale.

Cu [Sync](/info/sync.html) activat, o creație păstrată astfel ajunge și pe celelalte dispozitive ale tale. Versiunile ei rămân pe dispozitivul pe care au fost create.

Dacă o creație este deschisă în două file și salvezi în ambele, se păstrează ultima salvare. Munca înlocuită se află în **Protected drafts** din History al creației, cu **Open draft as a copy**.

Acest lucru funcționează doar în aplicația web, nu în aplicațiile desktop sau mobile și nici când lucrezi live cu altcineva.
:::

<!--i:eti-download-->
## Găsește un fișier descărcat

Într-un browser, **Download** trimite fișierul browserului. Browserul salvează fișierul în folderul de descărcări (de obicei **Downloads**) sau te întreabă unde. Lolly nu află unde a ajuns fișierul, așa că verifică lista de descărcări a browserului.

Dacă nu a apărut niciun fișier, verifică panoul de export cât ești încă în instrument. Sub **Download**, un rând arată numele fișierului și ora, cu **Retry download**. În Chrome, Edge și alte browsere Chromium, rândul oferă și **Save file…** ca să alegi un folder. Rândul și fișierul lui rămân până părăsești instrumentul, reîncarci sau exporți din nou.

Lolly mai păstrează două lucruri după fiecare descărcare:

- **O copie a fișierului**, în **Assets**, sub **Your uploads**, cât timp **Save my renders to my library** este activat în **Settings → Your renders** (**Settings** se află în partea de jos a ecranului principal). Setarea este activată inițial. Pentru un videoclip sau un fișier de peste 50 MB, îți cere mai întâi confirmarea, iar un zip nu este copiat.
- **Setările folosite**, pentru ultimele 24 de descărcări. **Recent exports**, sub munca salvată în **Projects**, redeschide instrumentul cu acele setări. Imaginile și fișierele adăugate de pe dispozitivul tău nu sunt incluse. Aceeași listă se află în **Settings → Activity & stats → Latest exports** și în fila **Changes** din **History**.

::: details În aplicațiile desktop și mobile
- **Aplicația desktop:** **Download** salvează într-un folder **Lolly** din folderul **Downloads**, fără dialog. Rândul de sub **Download** spune unde a ajuns fișierul, precum "Saved to Downloads/Lolly", cu **Show in folder**. **Open Exports Folder**, din meniul **Window** sau **Exports**, deschide folderul oricând. Un fișier cu același nume ca unul anterior este salvat ca "name (1)".
- **iPhone și iPad:** fișierul este salvat în aplicația **Files**, sub **Lolly**, iar panoul de partajare se deschide. Rândul de sub **Download** arată "Saved to Files → Lolly".
- **Android:** se deschide meniul de partajare. Alege unde ajunge fișierul.

Pe iPhone, iPad și Android, un fișier nou înlocuiește unul anterior cu același nume.
:::

<!--i:eti-history-->
## Întoarce-te la o versiune anterioară

- **În timpul acestei vizite:** **Undo** parcurge înapoi ultimele 100 de modificări, până părăsești instrumentul sau reîncarci. Vezi [Anulare și refacere](/info/using.html#undo-and-redo).
- **În [instrumentele care salvează pe măsură ce lucrezi](#which-tools-save-as-you-work):** se păstrează versiunile anterioare ale fiecărei creații.
- **Tot ce se află pe dispozitiv:** cu [Sync](/info/sync.html) activat, **Restore an earlier copy**, din **Settings → Connected services**, restabilește una dintre ultimele șapte copii zilnice sau copia de dinaintea ultimei aplicări. Tot ce se află pe acest dispozitiv corespunde apoi acelei copii.

Ca să deschizi o versiune anterioară:

1. Apasă **History**, butonul cu ceas de lângă **Undo** și **Redo**. În Lolly Design, **History** se află în bara de sus. Pe telefon, apasă **•••**, apoi **History**. În instrumentele fără **Undo**, precum Text și Lolly Sandbox, **History** se află lângă **Home** în stânga sus.
2. Găsește versiunea după dată și oră. Rândurile **Automatic checkpoint** sunt înregistrate pe măsură ce lucrezi; rândurile **Saved version** sunt momentele când ai salvat.
3. Apasă **Open as a copy**. Versiunea se deschide ca o creație nouă, iar cea pe care o aveai deschisă rămâne cum era. Copia se află în **Projects**, cu "(copy)" după nume.

Ca să păstrezi o versiune cu nume, apasă **Name version**, scrie un nume și apasă **Keep milestone**. Versiunile denumite sunt listate pe pagina **History**, sub **Milestones**.

::: details Panoul History și pagina History
Panoul **History** listează și rânduri **Recovered work**, iar **Protected drafts** păstrează ultimele modificări dintre punctele de control, cu **Open draft as a copy**. **Lolly Compare** și **Check assets** te ajută să alegi înainte să deschizi o copie. Schimbă **This creation** în **All history on this device** ca să vezi fiecare creație.

Punctele de control automate se răresc în timp: unul pe minut pentru ultima oră, unul pe oră pentru ultima zi, unul pe zi timp de 30 de zile, apoi unul pe săptămână. Se păstrează toate versiunile salvate și denumite. Ștergerea unei creații îi mută și versiunile în **Trash**, iar **Delete forever** le elimină.

Când se umple spațiul de stocare pentru History, sunt eliminate mai întâi cele mai vechi puncte de control automate ale creațiilor pe care nu le-ai deschis de 30 de zile. Chiar și atunci, o salvare este mereu păstrată. Este scrisă ca munca actuală, iar History spune că această salvare nu este păstrată ca versiune. **Settings → Storage** arată cât spațiu folosește History.

Pagina **History** (`#/history`) cuprinde fiecare creație din acest browser. Ca să deschizi pagina, apasă butonul cu ceas din dreapta sus a ecranului principal sau din **Projects**, alege **Saved sessions** din meniul profilului (pe telefon, butonul rotund cu logo din dreapta sus) sau apasă **Open app history** în panoul History al unui instrument. Aplicațiile desktop și mobile nu au pagină History. Acolo, butonul cu ceas de pe ecranul principal și **Saved sessions** deschid **Your recent work**: cele mai recente sesiuni salvate și exporturi, cu un link către Projects.

- **Recent** listează creațiile tale, cele mai noi primele, cu **Resume**.
- **Changes** pune punctele de control, descărcările și rezultatele Convert pe aceeași cronologie. O descărcare are **Reopen settings**.
- **Milestones** listează versiunile denumite.

Fiecare creație este un card cu imaginea ei. **Grid** sau **List** schimbă layoutul. Filtrează după proiect, instrument și dată (în **Filters** pe telefon). Meniul unui card (clic dreapta sau apăsare lungă) oferă **Resume**, **Versions**, **Show in Projects** și **Move to Trash**. Ca să elimini mai multe, selectează-le și alege **Move to Trash**, care oferă Undo.
:::

<!--i:eti-folder-move-->
## Mută-ți munca pe alt dispozitiv

| Ca să | Folosește |
|---|---|
| Păstrezi dispozitivele sincronizate | **Sync across devices**, în **Settings → Connected services**: vezi [Sincronizează-ți dispozitivele](/info/sync.html) |
| Muți totul o singură dată | **Export my data** și **Import data…**, mai jos |
| Predai un design sau un proiect | Un fișier `.lolly`: **Export**, apoi **Share**, apoi **Download .lolly**; pentru un proiect întreg, **Download project (.lolly)** din meniul folderului. Apasă **Open** pe celălalt dispozitiv. Vezi [Fișierul .lolly](/info/using.html#the-lolly-file) |

Un link de partajare conține setările tale, dar nu și imaginile sau fișierele adăugate de pe dispozitivul tău.

::: note Importul adaugă și nu șterge nimic
Folderele, favoritele și șabloanele din fișier sunt adăugate la cele deja existente pe celălalt dispozitiv. Când un element salvat se află în ambele locuri, se păstrează copia salvată mai recent. Datele și setările tale de pe acel dispozitiv rămân cum sunt. Cele necompletate sunt completate din fișier. **Bring it to this device**, din Sync, funcționează la fel.
:::

Ca să muți totul o singură dată:

1. Pe vechiul dispozitiv, deschide **Settings → Storage** și, sub **Move to another device**, apasă **Export my data**. Lolly descarcă un singur fișier `.zip` al cărui nume începe cu `LollyTools-`.
2. Transferă fișierul prin USB, printr-un email trimis către tine, prin AirDrop sau printr-un folder partajat.
3. Pe noul dispozitiv, deschide **Settings → Storage**, apasă **Import data…**, alege fișierul și apasă **Import**.

::: note Ce rămâne în urmă
Autentificările, cheile și fraza de acces pentru sincronizare rămân pe fiecare dispozitiv. Lista de descărcări recente, descărcările offline și modelele AI nu se transferă prin nicio metodă. Istoricul versiunilor se transferă doar într-un fișier **Export my data**, nu prin Sync sau un `.lolly`. Când istoricul este prea mare pentru un singur fișier, cele mai vechi puncte de control automate sunt omise, iar rândul de export spune câte. Poți descărca și deschide o copie pe care Sync o păstrează în spațiul tău de stocare sau poți alege copia în **Import data…**, ca pe un fișier de rezervă. O copie criptată îți cere fraza de acces.
:::

::: details Ce conține fișierul de rezervă
Fișierul se numește `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Părțile numelui provin din profilul tău și sunt omise dacă nu sunt completate. `<n>` numără exporturile făcute în aceeași zi. Conține profilul tău, cu folderele, Trash, șabloanele și favoritele; fiecare sesiune salvată cu miniatura ei; imaginile, fonturile și logourile încărcate și copiile descărcărilor tale; sistemele tale de design; preferințele tale (temă, lățimea barei laterale, statistici de activitate locale); versiunile salvate și rezultatele din Convert; și, din aplicația web, istoricul versiunilor creațiilor tale.

Cache-ul catalogului nu este inclus. Noul dispozitiv îl descarcă din nou. Fiecare parte are o sumă de control, astfel încât importul detectează un fișier deteriorat în timpul transferului. Sesiunile salvate se leagă din nou de imaginile importate. Aplicațiile web, desktop și mobile citesc același fișier. Aplicația de terminal scrie o copie de siguranță proprie, mai simplă, pe care acest format nu o citește. **Export my data & render everything** creează același fișier plus un al doilea zip cu fiecare sesiune salvată randată în formatul ei de ieșire. Formatul complet este descris în [Transfer de date](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Dacă ștergi datele browserului

În aplicația web, Lolly păstrează totul în spațiul de stocare al browserului pentru acest site: munca salvată, imagini, fonturi, sisteme de design, istoricul versiunilor și descărcări offline. Ștergerea datelor acestui site din browser elimină toate acestea, iar Lolly nu poate recupera nimic din ele. Rămâne ceea ce a ieșit deja din browser: fișierele descărcate, un fișier **Export my data**, o copie [Sync](/info/sync.html) și linkurile partajate.

::: warning Înainte să ștergi datele browserului
Apasă **Export my data** în **Settings → Storage** și păstrează fișierul în altă parte.
:::

Când aplicația pornește, Lolly îi cere browserului să nu-i șteargă datele stocate când dispozitivul rămâne fără spațiu, iar browserul decide. În **Settings → Available offline**, un rând care începe cu **Protected** înseamnă că browserul a fost de acord. "The browser may clear downloads if the device runs low on space" înseamnă că nu a fost de acord, iar **Protect downloads** cere din nou.

Dacă browserul nu a fost de acord, poate șterge atât munca salvată, cât și descărcările când spațiul este insuficient, așa că păstrează un fișier **Export my data** recent.

**Settings → Storage** arată cât spațiu folosește fiecare tip de date. Rândul **History** numără punctele de control automate, previzualizările lor și ciornele de recuperare. **Remove automatic checkpoints older than 30 days** eliberează acel spațiu și păstrează versiunile salvate și denumite. **Clear cache** elimină fișierele de catalog descărcate, care se descarcă din nou când este nevoie. **Clear all my data** îți cere să tastezi un cuvânt, dezactivează Sync, apoi elimină tot ce păstrează Lolly în acest browser: profilul și setările tale, sesiunile salvate cu istoricul lor și Trash, fișierele încărcate, fonturile și sistemele de design, jurnalul descărcărilor, rezultatele Convert, modelele AI descărcate și copiile offline. Fișierele descărcate rămân unde le-ai salvat. Aplicația pornește apoi ca la prima vizită.

![Cardul de stocare pe un ecran de lățimea unui telefon: fiecare categorie de date de pe dispozitiv este denumită, cu butonul Clear all my data în partea de jos](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

În aplicațiile desktop și mobile, sesiunile salvate sunt fișiere în folderul de date propriu al aplicației, iar restul se află în stocarea proprie a aplicației. Ștergerea datelor unui browser web nu le afectează.

::: details Unde păstrează aplicațiile desktop și mobile sesiunile salvate
Un fișier pentru fiecare sesiune salvată, într-un folder `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/` sau aceeași cale sub `$XDG_DATA_HOME`
- iPhone, iPad și Android: în stocarea proprie a aplicației, pe care aplicația Files nu o afișează

Imaginile, sistemele de design și lista de descărcări recente rămân în stocarea internă a aplicației, nu în aceste foldere. Aplicația de terminal și linia de comandă citesc același folder `saved-state`: vezi [Unde se află sesiunile salvate](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Recuperează ceva ce ai șters

Ștergerea unei sesiuni salvate, a unui folder, a unui fișier încărcat sau a unui font al tău din aplicație îl mută în **Trash** timp de 30 de zile, indiferent de unde îl ștergi: **Projects**, **Assets**, **Settings → Storage** sau lista de sesiuni salvate a unui instrument. Un folder și tot conținutul lui ajung în Trash ca o singură intrare. O sesiune își păstrează istoricul versiunilor în Trash. Imediat după ștergere, un mesaj oferă **Undo**. Mai târziu:

1. Deschide **Trash**: cardul **Trash** din **Projects**, butonul **Trash** din **Assets → Your uploads** sau rândul **Trash** din **Settings → Storage**. Toate trei deschid aceeași listă.
2. Apasă **Restore** lângă element. Acesta revine în folderul lui, iar un font își recapătă rolurile pe care le avea în sistemul lui de design.

**Delete forever** elimină definitiv un element. **Empty Trash** cere mai întâi confirmare, apoi elimină fiecare element din Trash. Elementele mai vechi de 30 de zile sunt eliminate definitiv.

::: warning Unele ștergeri sunt imediate
Un sistem de design, un logo sau fotografia ta de profil nu ajung în Trash când le ștergi. Și linia de comandă și aplicația de terminal șterg imediat.
:::

Cu [Sync](/info/sync.html) activat, **Restore an earlier copy** poate restabili starea întregului dispozitiv dintr-o zi anterioară, iar un fișier **Export my data** restabilește ceea ce conține.
