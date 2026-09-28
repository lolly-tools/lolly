# Brand Studio

**Brand Studio** la `#/start` este singurul loc unde îți modelezi brandul - logourile, culorile, tipografia, restul tokenilor tăi și fișierele pe care le păstrează. Setează-l aici o dată și fiecare unealtă, pagină și export îl urmează *prin construcție*, nu prin verificare.

Modificările se previzualizează **live în toată aplicația** pe măsură ce le faci, ca să poți vedea o culoare sau un font aplicat peste tot înainte să îl confirmi. Totul este pe dispozitiv: fișierele și tokenii brandului tău nu părăsesc niciodată mașina ta (alegerea unui Google Font preia acea familie o singură dată de la Google, după un dialog de consimțământ), iar brandul călătorește într-un singur fișier [brand pack](#move-a-brand-between-devices).

> **Acesta este editorul. Dashboard-ul este oglinda.** Tab-ul **Design system** din Dashboard (`#/d`) *afișează* brandul tău doar pentru citire; tu îl *editezi* aici, la `#/start`. Dacă vrei să schimbi o culoare mai târziu, revino la Brand Studio.

## Camerele

Studioul este un set de **camere** listate într-o bară laterală - nu pași. Nimic nu este numerotat, nimic nu este condiționat de altceva și a ajunge în oricare dintre ele este legitim:

- **Overview** - centrul. Ce există chiar acum, dintr-o privire, cu o ușă spre fiecare cameră.
- **Colours** - adaugă culori pe rând, atribuie roluri sau generează o paletă întreagă dintr-una singură.
- **Type** - cele patru fonturi pe care le citesc aplicația, uneltele tale și fiecare export.
- **Logos** - mărcile tale, în fiecare orientare și tratament.
- **Tokens** - raza colțurilor, spațiere, umbre și restul sistemului.
- **Files** - fișierele de imagine, audio și animație pe care le păstrează brandul tău.

Pe telefon, aceeași listă devine o bandă orizontală de chip-uri fixată sub antet. Schimbarea camerei nu reîncarcă niciodată nimic - editorul păstrează toate panourile montate și pur și simplu afișează pe cel cerut.

**Trimite direct către o cameră** cu `#/start?area=<key>`. Cheile sunt `overview`, `color` *(observă ortografia americană din URL)*, `type`, `logos`, `tokens`, `catalogue` (camera Files - cheia panoului este un contract permanent, deci URL-ul păstrează numele vechi) și `versions`. `?tab=` este aliasul de multă vreme pentru același lucru și încă funcționează, deci linkurile vechi și marcajele continuă să funcționeze; orice nerecunoscut deschide Overview în loc să eșueze.

Fixate la **baza barei** sunt acțiunile care aparțin întregului sistem de design, nu unei singure camere:

- **Add from…** - selectorul de sursă, pentru a aduce un brand dintr-un fișier, un PDF, o imagine, un font sau un site web. Vezi [Bring a brand in](#bring-a-brand-in) mai jos.
- **Tray** - candidații pe care o scanare i-a găsit dar nu i-a confirmat încă. Rămâne ascuns până când o scanare păstrează efectiv ceva, și afișează un număr când o face; nimic din el nu îți schimbă brandul până apeși Add pe acel rând.
- **Export** - scrie întregul sistem de design ca un singur `LollyBrand-….lolly`.
- **Tokens (.json)** - documentul simplu de design tokens de sine stătător, pentru un repo, un pas de build sau o altă unealtă de tokeni.
- **Restore brand settings** - revino la un punct de control salvat înainte de un import sau o înlocuire a setărilor de brand.
- **Versions** - publică, activează și restaurează copii denumite ale sistemului de design. Ascuns până există ceva propriu de publicat (sau până un link `?area=versions` îl cere pe nume).

![Bara camerelor studioului - Overview, Colours, Type, Logos, Tokens și Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview este prima cameră, și are două fețe.

Cu **nimic ales încă**, spune **Fă-l al tău**. **Start from a reference** deschide selectorul de sursă pentru un logo, o captură de ecran, o pagină web sau un fișier de design. **Alege o culoare**, **Alege un font** și **Adaugă un logo** deschid direct comenzile lor existente. Fiecare traseu începe cu o alegere; deschiderea uneia nu scrie nimic. **Explorează instrumentele** este disponibil imediat.

Odată ce ceva e al tău, aceeași cameră arată **ce ai**, cu numerele pe care le-ai făcut în frunte. Colours citește numărul de culori pe care le poartă sistemul de design, și adaugă un discret `· N starter` doar acolo unde sunt culori moștenite afișate; banda de lângă el pune întâi culorile pe care le-ai ales tu, apoi o linie fină și cele starter, estompate. Type citește pe rol (*Inter pentru titluri*, cu *Starter pentru rest · SUSE, SUSE Mono* dedesubt). Logos citește câte sloturi sunt completate, sau **Nesetat**. Tokens poartă raza colțurilor, marcată *starter* până o muți. Files spune **Nimic încă** cât timp biblioteca e goală. Fiecare bloc este o ușă spre camera lui. Aici sunt numere, niciodată o bară de progres și niciodată un card de finalizare - nimic în acest studio nu este datorat.

## Logos

Începe golind folderul tău de mărci în zona de plasare din partea de sus: **"Drop marks here, or choose several at once"** preia câte fișiere ai, dintr-o dată. Fiecare fișier este citit pentru forma și cerneala lui, apoi pus în coadă sub **Waiting for a slot** ca un chip care spune ce crede - *"Looks like the Horizontal primary"*, cu măsurătoarea pe care s-a bazat, și un buton **Place** (**Replace**, acolo unde slotul e deja ocupat). Acolo unde nu e sigur, chipul spune asta clar și oferă în schimb **Change slot**, care le listă pe toate opt. Nimic nu este plasat până nu apeși ceva.

Două lucruri se întâmplă în jurul acelei cozi. O marcă cu margine goală în exces primește mai întâi o **ofertă de decupare** - răspunde-i sau apasă Escape și fișierul original intră neschimbat. Și acolo unde o marcă poate furniza un slot frățesc gol, camera oferă versiunea derivată **mono** sau **reverse** ca propriul ei chip, marcat *Generated*, care dispare din nou dacă completezi acel slot altfel.

Sub aceasta se află grila în care ajunge fiecare marcă - sloturi **orientare × tratament**:

- **Orientări:** Horizontal (wordmark + simbol pe un rând) și Vertical (suprapus, pentru spații pătrate și înalte).
- **Tratamente:** Primary, Primary reverse (pentru fundaluri întunecate), Mono (o singură culoare) și Mono reverse.

Acestea sunt opt sloturi opționale. Apasă un slot pentru a adăuga un PNG, SVG, JPEG sau WebP; apasă un slot completat pentru a-l înlocui. Fiecare slot este opțional și totul rămâne pe acest dispozitiv.

![Matricea de logouri - fiecare orientare pe rândul de sus, fiecare tratament ca slot propriu punctat, toate opționale](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - adaugă mărci pe care brandul tău le numește în felul lui (o iconiță, o insignă, un favicon) sub **Custom marks**; denumește-o și alege un fișier.
- **More identities** - un sub-brand, produs sau eveniment poate avea propriul set complet de logouri. Folosește **+ Add another logo** și denumește-l; setul tău principal este pur și simplu "Your logo".
- **Încarcă un SVG și Lolly îi citește culorile.** La o instalare nouă, setează discret culoarea ta primară din logo și spune asta. La un brand existent, oferă în schimb culoarea ca sugestie - *"Found in the logo: #…"* cu un buton **Folosește ca principal** lângă ea - în camera Colours, unde o poți accepta sau respinge.

## Colours

Camera crește odată cu sistemul de design. Nimic de care nu ai avut încă nevoie nu se află pe pagină, așa că o primă vizită înseamnă o singură decizie, iar restul sosește pe măsură ce paleta crește.

### Prima culoare

Un sistem de design fără culori proprii se deschide pe o singură coloană centrată: **Start with one colour**, un chip live mare, un câmp, și o linie discretă care spune că rolurile, nuanțele și setările de tipar sosesc pe măsură ce sistemul crește.

- **Chip-ul este selectorul.** Apasă-l și cardul OKLCH propriu al studioului se deschide pe chip, pornind de la ce ține câmpul: un nume, roata, cele patru cadrane, alfa și **Stocat ca**, cu **Anulează** și **Adaugă culoare** la bază. Tragerea unui cadran colorează chip-ul și rescrie câmpul pe măsură ce lucrezi, și nimic nu ajunge la sistemul de design până apeși **Adaugă culoare**.
- **Câmpul acceptă orice notație** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` sau un nume simplu de culoare - iar o *listă* întreagă de culori devine un rând de chip-uri pe care le adaugi unul câte unul.
- **Încă două uși stau alături.** Pipeta (pe un browser care are una) preia o culoare de pe ecran, iar **Preia culori dintr-o imagine** citește o captură de ecran sau o fotografie de pe acest dispozitiv și oferă culorile pe care le găsește.
- **Add nu este niciodată dezactivat.** Cu nimic lizibil în câmp, deschide selectorul, ceea ce înseamnă de obicei o apăsare pe gol; un text pe care nu-l poate interpreta primește o linie sub câmp care spune asta, în loc de un buton mort.

Prima culoare devine **Principal**, iar chip-ul care răspunde adăugării spune asta - *„Principal este acum Vivid Violet”* - cu **Ajustare fină** alături.

![Camera Colours fără nimic ales încă - un chip live mare, un câmp și o linie despre ce sosește mai târziu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** este cuvântul pentru orice a venit cu aplicația în loc să fie ales. O instalare nouă nu poartă nicio culoare deloc: ce are este o singură rampă neutră, cerneală prin hârtie, astfel încât suprafețele, textul și liniile fine se randează înainte ca cineva să fi decis ceva. Aceste neutre sunt schelărie, deci nu sunt numărate ca și culori și nu sunt desenate în panoul paletei. Trăiesc în camera [Tokens](#tokens) ca **Neutre · inițial · 9**, cu un **Deschide** care le arată în panoul Colours ca un grup pliat, etichetat (`#/start?area=color&group=neutral`).

Același cuvânt continuă prin fiecare cameră: un rol care stă pe o culoare starter se citește *„Starter Paper stands in”* și selectorul lui oferă **Alege…**; un font starter poartă o etichetă **Starter** și fără nuanțare; o rază de colț starter este etichetată pe Overview. Materialul moștenit nu este niciodată desenat cu o margine punctată, pentru că o margine punctată înseamnă aici o zonă de plasare.

### Pe măsură ce paleta crește

Culorile tale stau alături de o previzualizare **In context** pe un ecran lat și se stivuiesc deasupra ei pe ecrane mai mici. Previzualizarea poate arăta un poster, un grafic sau un card de interfață folosind paleta ta. Culorile starter rămân în propriul lor grup pliabil, separat de culorile pe care le adaugi.

Adaugă culori individuale sau un set de nuanțe, atribuie-le rolurile, și deschide secțiunile avansate când ai nevoie de ele. Diagrama de culori, degradeurile și comenzile de descărcare rămân cu paleta.

![Camera Colours după adăugarea unei culori, cu paleta ei și o previzualizare live a compoziției](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - ce citesc uneltele

**Roles** este stratul de deasupra eșantioanelor: ce culoare joacă fiecare parte, în fiecare unealtă și export. Rolurile sunt opționale (un sistem de design cu trei culori independente și fără roluri este unul perfect valabil), orice eșantion poate primi unul, iar citirea contrastului este măsurată față de suprafață, mai întâi APCA.

Un rând se citește într-unul dintre trei registre, așa că banda nu pretinde niciodată o decizie pe care nimeni n-a luat-o:

- o culoare proprie care servește rolul, la intensitate maximă;
- **Starter *Paper* stands in** - estompat, cu **Alege…** pe selectorul său;
- **↳ urmează Primar** - rolul se rezolvă prin culoarea principală, în loc de o culoare proprie.

Odată ce paleta are nuanțe, banda crește la toate cele șapte sloturi pe care le poate citi o unealtă: Principal, Secundar, Suprafață, Text, Estompat, Margine și Pe principal. Pe principal este derivat din culoarea principală, se citește **Derivat** și nu poartă selector.

**Accentul propriu al aplicației este o preferință, nu un token.** Implicit, interfața urmează sistemul de design, iar accentul cromului preia culoarea principală. Aceasta este o setare de Appearance pe [profilul tău](/info/profile.html) - **Interfața urmează sistemul de design** - iar dezactivarea ei lasă cromul neutru. Uneltele, canvasurile și exporturile nu sunt afectate în niciun caz, iar fonturile și raza colțurilor urmează sistemul de design indiferent dacă setarea e activă sau nu.

### Aripile pentru experți

Patru secțiuni pliate stau sub previzualizarea compoziției și rolurile de culoare. Deschide-o pe cea pe care o vrei; fiecare poate fi accesată direct ca `#/start?area=color&focus=<wing>`, care o deschide indiferent ce arată camera altfel:

- **Explore shades & harmonies** (`focus=generate`) - o culoare într-un set complet de nuanțe. Descris mai jos.
- **Shade curves** (`focus=curves`) - remodelează un ramp punct cu punct. Luminozitatea, croma și nuanța primesc fiecare propria curbă, comutabile cu L / C / H, iar nuanțele de mai jos se recalculează live pe măsură ce tragi.
- **Contrast** (`focus=contrast`) - **Contrast-lock** reechilibrează un ramp pentru a atinge ținte APCA față de un fundal pe care îl alegi, fiecare pas păstrându-și propria nuanță și cromă; **Rotate hue** rotește întregul ramp în bloc pe roata cromatică, fiecare nuanță păstrându-și luminozitatea și croma.
- **Print** (`focus=print`) - ce devine culoarea principală la tipar: valoarea ei automată pentru ecran, sau o valoare CMYK fixată ori o cerneală spot denumită în schimb.

### O culoare, o paletă întreagă

În **Explore shades & harmonies**, alege o **Starting colour**. Lolly sugerează nuanțe potrivite folosind aceeași matematică perceptuală a culorii (OKLCH) pe care motorul o folosește peste tot. Ajustează sugestiile:

- **Scheme** - Mono, Complement, Analogous sau Triad - stabilește cum se raportează culoarea secundară la cea principală a ta.
- **Shades** - un cursor de la 3 la 20 (implicit 5) controlează câte trepte generează fiecare ramp.
- **Fine-tune** (pliat) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) și **Text on brand** (Auto / Light / Dark).

Schimbarea culorii de start și a comenzilor modifică doar sugestiile. Apasă pe o nuanță pentru a adăuga acea culoare, sau **Adaugă 5 nuanțe** pentru a adăuga un grup (numărul urmează setarea ta Shades). Culorile și rolurile existente rămân neschimbate. Anulează elimină adăugarea.

Rândurile **Principal**, **Neutru** și **Secundar** arată nuanțele sugerate. Deschide **Theme preview** pentru a inspecta exemplele deschise și întunecate și citirile lor de contrast. Alege acolo o treaptă Neutru sau Secundar pentru a ajusta ancorele de temă propuse. Reconstruirea întregii palete rămâne o acțiune separată, revizuită, mai jos.

![Trei grupuri de nuanțe sugerate, cu comenzi individuale de adăugare și un Theme preview separat](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Creează-ți paleta (generator de armonii)

În **Find matching colours**, generatorul de armonii sugerează culori de accent asortate din culoarea principală. Alege o **Harmony** - **Complementară**, **Adiacentă**, **Triadă**, **Tetradă** sau **Analoagă** (care aduce propriul număr de **Accente**, de la 2 la 5, și un **Unghi** de nuanță de la 10° la 45°) - iar fiecare candidat vine cu un nume generat automat, ușor de citit, și un buton **+ Adaugă**. Adăugarea uneia pune imediat acea culoare în paletă, o apăsare pentru un token. **In context** previzualizează culorile adăugate de tine pe compoziții demonstrative.

![Accente generate, fiecare cu un eșantion, un nume generat automat, codul hex și un buton Adaugă](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confirmarea unei palete generate

Adăugarea unei culori sau a unui grup de nuanțe sugerate păstrează restul paletei tale. Pentru o înlocuire completă, deschide **Rebuild the whole palette…** și apasă **Preview full rebuild**. Recenzia explică schimbările: câte roluri rămân așa cum le-ai atribuit, câte culori adăugate de tine sunt păstrate, câte curbe de nuanțe sunt reancorate, câte blocaje de tipar sunt re-fixate, câte nuanțe ascunse rămân ascunse, câte capete de degrade își păstrează culoarea.

**Apply rebuilt palette** de pe acel card o confirmă; **Anulează** renunță și nu schimbă nimic. După ce a rulat, cardul oferă **Anulează** cu focusul deja pe el - iar un punct de control al întregului sistem de design este creat *înainte* de schimbare, așa că „pune-l înapoi cum era” înseamnă o restaurare, nu o după-amiază pierdută.

### Paleta, graficul și fiecare eșantion

Paleta listează culorile sistemului de design în grupuri pliabile, fiecare cu propria comandă **+ Adaugă**. Creează și redenumește grupuri ca să-ți organizezi lucrul. Un rol nu creează niciodată o a doua dală: un token este o dală, iar o dală spre care indică un rol poartă în schimb un mic semn de colț (**P**, **S**, **Su**, **T**). Sub dale, **Diagramă de culori** se deschide pe două vizualizări ale acelorași eșantioane: **Roată** (roata OKLCH - trage un punct pentru a-i schimba culoarea, apasă un punct pentru a-l edita sau apasă un spațiu gol pentru a adăuga un eșantion nou) și diagrama **Gamut**, care arată unde se termină de fapt intervalul afișabil. `#/start?area=color&focus=chart` deschide direct cardul, la fel ca `?wheel` dintotdeauna.

![Panoul paletei, fiecare grup putând fi restrâns, cu pastila de descărcare fixată la marginea de jos](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roata OKLCH - unghiul este nuanța, distanța spre exterior este saturația, iar gri-urile urmează o bandă de luminozitate pe lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Apasă pe orice eșantion pentru a-i deschide editorul:

- **Rename** (Redenumește) eșantionul.
- **Set the colour** (Setează culoarea) - selectorul se deschide pe cursoare perceptuale **OKLCH**, cu moduri pentru **Hex**, **HSL**, **RGB** și **CMYK**; câmpul de valoare citește *și* scrie în orice spațiu este activ, așa că poți lipi un cod hex sau introduce procente de cerneală. Reține că introducerea unui CMYK setează culoarea de *ecran* prin conversie - pentru a fixa cerneluri exacte, folosește blocajul de tipar de mai jos.
- **Stored as** (Stocat ca) - alege cum este păstrat eșantionul: **LCH** (implicit - perceptual, gamă largă, cea mai bună alegere pentru editare), Hex, RGB sau HSL. Suprascrie-l când trebuie să fixezi un cod hex vechi exact sau să potrivești o valoare sRGB.
- **Use as** (Folosește ca) - atribuie acest eșantion direct unuia dintre rolurile de brand, fără să te întorci la panoul Roles. (Propria filă a unui rol nu îl oferă - un rol nu poate prelua alt rol.)
- **Print substitutes** (Înlocuitori de tipar, restrâns) - blochează comportamentul de tipar al culorii:
  - **CMYK** - comută-l din **Auto** în **Locked** pentru a suprascrie conversia automată sRGB→CMYK cu valori exacte de cerneală (C/M/Y/K, 0-100).
  - **Spot colour** (Culoare spot) - comută-l din **None** în **Set** pentru a fixa eșantionul la o culoare spot; dă-i un **Name** (de ex. `PANTONE 186 C`), opțional un **Book** și opțional un **Finish** (Ordinary ink implicit) pentru cazul în care cerneala nu este deloc o cerneală - o folie, un relief în relief sau în adâncime, un lac spot, un finisaj soft touch sau un decupaj, o linie de îndoire sau o perforație.
- **In other spaces** (În alte spații, restrâns) - aceeași idee extinsă: fiecare rând este un spațiu în care acest eșantion poate fi exprimat, fie derivat din valoarea canonică, fie definit de tine, iar unul definit de tine câștigă la export.

Aceste blocaje de tipar sunt cele pe care le folosește o tipografie când exporți un PDF sau TIFF CMYK - vezi [Exportare](/info/exporting.html#colour-profiles).

**Ștergerea unui eșantion** este sigură: pașii de rampă derivați și rolurile de temă sunt *ascunși* (token-ul de bază continuă să se rezolve, deci nimic din aval nu se strică), în timp ce culorile adăugate de tine sunt eliminate definitiv.

### Lucrul cu multe eșantioane

Fiecare eșantion are propriul mâner de tragere. Trage-l pentru a reordona culorile în cadrul grupului său, sau focalizează-l, apasă Space, folosește săgețile, și apasă din nou Space pentru a-l plasa. Escape anulează. Ordinea supraviețuiește redeschiderii studioului și poate fi anulată. Ca să muți culori între grupuri, folosește comanda **Grupează** din editorul eșantionului sau selectează mai multe culori și folosește **Mută**. Numele tokenilor și referințele de rol rămân intacte.

Selecția în panoul paletei este un gest, nu un mod. Nu există un buton de apăsat mai întâi, iar bara apare odată cu prima dală selectată și dispare odată cu ultima.

- **Trage pe spațiul gol al panoului** pentru a desena un dreptunghi: fiecare dală pe care o atinge se alătură selecției, peste granițele grupurilor. O secțiune pliată nu contribuie cu nimic, iar o tragere care nu se mișcă niciodată golește selecția.
- **Shift-click** ia intervalul în ordinea citirii; **Cmd/Ctrl-click** comută o dală; un click simplu tot deschide editorul acelei dale.
- Fiecare antet de grup poartă **Selectează tot**, iar **Cmd-A** cu o dală focalizată ia fiecare culoare pe care o deține sistemul de design - niciodată una starter.
- Grila are un singur punct de tab. Săgețile o parcurg, Shift-săgețile extind selecția, Space comută o dală, Delete elimină selecția, iar Escape o golește. (Săgețile doar mută focusul: ca să ajustezi un canal, apasă mai întâi `l`, `c` sau `h`, așa cum spune citirea.)
- Pe un ecran tactil nu există dreptunghi. Apasă și ține o dală pentru a începe o selecție, apoi atinge pentru a adăuga; **Selectează tot** per grup preia restul.

Bara însăși se citește **{n} selectate**, apoi **Mută în** (un grup existent, sau unul nou pe care îl denumești în meniu), **Atribuie un rol** (fiecare culoare selectată preia pe rând rolul următor, așa că patru dale umplu toate cele patru roluri dintr-o apăsare), **Descarcă** (selecția în oricare din cele șase formate de paletă), **Copiază valorile** (o linie per culoare, în notația ei stocată) și **Șterge**. Mută în și Atribuie un rol apar odată ce paleta are nuanțe de mutat. Un singur Ctrl/Cmd-Z anulează o întreagă acțiune în masă - o mutare de patruzeci, o distribuire de roluri, o ștergere - iar o ștergere spune ce a păstrat, pentru că o selecție ajunge la dale pe care această cameră nu le elimină.

### Degradeuri

Un panou opțional **Gradients** construiește tokenuri de amestec din paletă, pentru fundaluri și accente. Sari peste el complet dacă sistemul de design nu folosește degradeuri. Fiecare degrade are o previzualizare, capete numite (2-8) și un unghi. Comportamentul-cheie: **un capăt face referire la un eșantion**, deci recolorează acel eșantion și degradeul îl urmează. Interpolarea rulează în OKLCH pentru amestecuri curate. Șterge un capăt pentru a scurta șirul.

### Ia paleta în altă parte

Pastila plutitoare fixată la marginea de jos a panoului paletei descarcă întreaga paletă ca **Tokenuri de design (JSON)**, **Variabile CSS**, **Clase CSS**, **Variabile SCSS**, o **GIMP palette (.gpl)** sau un **Adobe Swatch Exchange (.ase)** - astfel încât sistemul de design intră direct în Illustrator, Figma, GIMP sau o foaie de stil. Stă în afara zonei derulabile a panoului, deci își păstrează locul indiferent cât de mult derulezi paleta, și apare odată ce paleta are nuanțe. (Poți descărca paleta și din [Resurse](/info/using.html#assets-your-library).)

## Tipografie

Această cameră crește la fel. Fără un font propriu, este un singur card și o singură decizie: **Principal**, setat la mărime de citire în fontul care îl servește azi, o etichetă **Starter** lângă nume, un buton plin **Alege un font** și linia *„Nimic nu se instalează până nu alegi unul.”* Sub card stă *„Titlurile, codul și italicul urmează principalul până le alegi”*, cu **Alege-le separat** dezvăluind celelalte trei carduri pentru restul vizitei.

![Camera Type fără niciun font ales încă - un card la mărime de citire, o etichetă Starter pe el și un buton plin Alege un font](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Alege un font și camera se deschide în **patru carduri de rol**, lista Fonts și specimenul live. Cele patru fonturi sunt cele pe care aplicația, uneltele tale și fiecare export chiar le citesc:

- **Primary** (Principal) - text de bază, butoane și fiecare unealtă.
- **Headings** (Titluri) - fontul de afișare pentru `h1`/`h2`.
- **Code** (Cod) - un font monospațiat pentru cod și date.
- **Italic** - un adevărat însoțitor italic pentru accentuare, citate și paranteze.

Titlurile, codul și italicul revin implicit la fontul principal până le atribui, deci un sistem de design cu un singur font nu are nicio decizie de luat aici.

**O nuanțare înseamnă că ai ales-o tu.** Un card este nuanțat doar acolo unde ai instalat acel font. Un font starter poartă aceeași etichetă **Starter** pe care o poartă grupurile moștenite ale paletei, în registrul estompat și fără nuanțare, iar un rol pe care nimeni nu l-a ales se citește **↳ urmează Primar**, în loc să repete numele principalului ca și cum ar fi fost ales. Butonul spune **Schimbă** pe un font propriu și **Alege un font** peste tot altundeva. Nimic de pe un card nu confirmă ceva: butonul deschide **scena de comparație** limitată la acel rol.

![Cele patru carduri de rol dezvăluite - fiecare setat în fontul care îl servește, cu o etichetă Starter acolo unde nimeni nu a ales unul și Italic urmând principalul](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Scena de comparație

![Scena de comparație deschisă sub cardul ei, cu rândul de căutare, familiile fixate și cardurile pliate într-o bandă pe un rând](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Scena se deschide **inline, în cameră**, nu într-un dialog, și direct sub cardul pe care l-ai apăsat. Cât timp este deschisă, cardurile se pliază într-o bandă pe un rând cu rolul și fontul, așa că scena încape pe primul ecran chiar și pe telefon. Escape anulează și predă tastatura înapoi cardului de la care ai deschis-o.

Alegerea unui font înseamnă trei apăsări:

1. **Alege un font** pe card.
2. Tastează un nume de familie și apasă **Previzualizare** - sau apasă una dintre cele șase familii **Fixat**, sub câmp, câte o apăsare fiecare. Cardul apare deja în încărcare, cu o bară schelet acolo unde va fi specimenul, în loc de fontul interfeței care ține locul unui font pe care nu l-ai văzut încă.
3. **Folosește acest font**.

**Consimțământul este cerut o singură dată, la apăsarea pe care ai făcut-o.** Prima dată când o previzualizare ajunge la Google Fonts, un dialog spune ce se întâmplă: *Google află numele familiei și adresa ta IP. Fișierul este apoi păstrat pe acest dispozitiv și folosit offline. Acesta este singurul pas din studio care ajunge la o terță parte.* **Preia de la Google** merge mai departe și este reținut. **Anulează** lasă cardul să spună *„Nepreluat. Nimic nu a fost trimis către Google.”* cu propriul său **Preia de la Google** viu, așa că a te răzgândi este o singură apăsare pe card. Niciun card nu arată vreodată un buton mort: indiferent în ce stare este, singurul lui buton principal spune care e pasul următor.

**Lasă un fișier de font pe scenă** și se previzualizează instantaneu - **TTF**, **OTF** sau **WOFF** de pe propriul tău calculator, ceea ce este calea pentru un font corporate licențiat pe care îl deții deja. Acea zonă de plasare este singura ușă de fișiere din cameră.

Oricum ar fi, fontul rămâne pe acest dispozitiv, se randează în aplicație, în uneltele tale și în fiecare export, offline pentru totdeauna, și călătorește în fișierul sistemului de design - nimic nu este preluat în momentul randării. Tot ce se află pe Google Fonts este livrat sub o licență deschisă (OFL/Apache/UFL).

### Fonts on this device

Panoul **Fonturi** listează fiecare font pe care îl deține acest dispozitiv și rolul pe care îl servește. Fonturile pe care le-ai adăugat conduc sub **În sistemul de design**, fiecare cu rolurile sale și o ștergere, iar cel care servește Principal poartă insigna. Fonturile starter urmează într-un rând pliat - *„Starter · SUSE, SUSE Mono · servind Principal și Cod până alegi”* - estompate, fără ștergere și fără nimic de promovat, pentru că niciuna nu este o decizie pe care a luat-o cineva. **Adaugă un font** deschide aceeași scenă de comparație, nelimitată.

Panoul **Roluri tipografice**, la bază, arată un specimen live al fiecărui rol - text de bază și UI în principal, un font de afișare opțional pentru titlurile de sus, un italic pentru accentuare, un monospațiat pentru cod și date - cu familia și starea ei alături de fiecare (*Inter*, *SUSE · starter*, *SUSE · urmează Principal*), astfel încât întregul set poate fi citit dintr-o privire.

## Tokenuri

Restul sistemului de design, editabil fără să atingi codul:

![Camera Tokens - un cursor pentru raza colțurilor plus spațiere, dimensionare, umbre și restul sistemului](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Colțuri rotunjite** - un singur cursor de rază (0-1.5rem) pe care îl urmează cardurile, butoanele și panourile din întreaga aplicație.
- **Neutrals** - rampa cerneală-prin-hârtie cu care vine o instalare nouă, listată ca **Neutre · inițial · 9** cu cele nouă trepte ale ei și un **Deschide** spre panoul Colours. Este singurul loc unde sunt gestionate neutrele starter, iar eticheta *starter* dispare din momentul în care rampa este generată, nu moștenită.
- **Mai multe tokenuri** - adaugă și editează **spațiere**, **dimensionare**, **grosime contur**, **opacitate**, **rotație**, **numere** simple și **umbre**. Alege un tip, dă-i un nume (*Gutter, Card shadow…*) și setează-i valoarea. Acestea sunt stocate ca [tokenuri de design](/info/design-tokens.html) standard (DTCG) și călătoresc împreună cu sistemul de design.

## Fișiere

Lasă aici fișierele pe care le păstrează brandul tău - în afară de logo-uri: active **vector**, de **imagine**, **audio** și de **animație** (video, Lottie, animate). Ajung în [Resurse](/info/using.html#assets-your-library), sortate pe secțiuni și gata de folosit în selectorul de active al fiecărei unelte. Totul rămâne pe acest dispozitiv. (Bara laterală etichetează camera **Files** (Fișiere); cheia din URL rămâne `catalogue`, pentru că o cheie de panou este un contract permanent.)

## Adu un brand

**Add from...** (Adaugă din...) de la baza barei laterale deschide un selector în două etape. Prima etapă întreabă ce *ai*, nu ce format este:

- **Design tokens or a design file** - JSON DTCG sau Tokens Studio, un proiect Penpot, o **arhivă zip cu seturi de tokenuri**, un pachet de sistem de design Lolly sau un SVG.
- **PDF** - un deck sau un fișier de ghiduri, citit pe acest dispozitiv pentru culorile, marcajele și fonturile sale încorporate.
- **Logo or screenshot** - o imagine devine o paletă sugerată, citită pe acest dispozitiv. Nimic nu este încărcat. Aceasta citește culori, nu fontul sau aranjamentul din imagine.
- **Saved web page** - alege un fișier HTML și fișierele lui CSS, sau lipește HTML sau CSS. Până la 20 de fișiere și 2 MB în total. Este citit doar textul furnizat; resursele legate nu sunt preluate și scripturile nu rulează. Această cale funcționează și fără extensie sau aplicația desktop.
- **Font file** - TTF, OTF sau WOFF. Deschide camera Type, unde se instalează fontul.
- **Website** - o singură pagină, citită pentru culorile și fontul ei. Această filă apare doar pe un dispozitiv care poate chiar citi o pagină, pentru că o filă dezactivată care promite ceva ce nimeni nu poate apăsa este mai rea decât nicio filă. Acolo unde apare, spune clar ce cititor este folosit: preluată de aplicație pe acest dispozitiv, sau citită prin extensia de browser într-un tab de fundal, autentificat ca tine. Introducerea unei adrese URL doar *precompletează* câmpul - butonul de preluare este consimțământul, deci un link trimis de altcineva nu poate porni niciodată o citire.

Alege sursa fișierului de design, iar a doua etapă este cardul de mai jos: formatele acceptate conduc ca file cu iconițe, în ordinea preferinței, iar întregul card este o singură zonă de plasare - apasă oriunde pe el sau trage un fișier peste el. Poți de asemenea să tragi un fișier direct în studio.

![Cardul de import - formatele acceptate conduc ca file cu iconițe, iar întregul card este o singură zonă de plasare](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Ce îți oferă fiecare fișier de design:

- un pachet **Lolly design-system** (`.lolly`; vechiul `.zip` este încă acceptat) - se instalează într-un singur pas;
- un export **Penpot** (`.penpot`) - preia tokenurile lui de design;
- un fișier **Design Tokens** (`.json`) - W3C DTCG;
- un fișier **Tokens Studio** (`.json`) - Tokens Studio;
- un **SVG simplu** (`.svg`) - Lolly îi scanează culorile și te lasă să alegi pe care să le păstrezi, prima devenind culoarea ta principală.

Un logo/captură de ecran, un site web sau o pagină salvată deschide **Your suggested design system**. Vezi un exemplu folosind culorile propuse, alege o **Main colour** diferită dacă e nevoie, și denumește sistemul. **Use this design system** aplică paletele deschisă și întunecată generate și te întoarce la Overview. Fonturile existente rămân neschimbate. Aceasta înlocuiește culorile sistemului activ și celelalte setări de tokeni. Un punct de control trebuie să reușească mai întâi; **Restore brand settings** recuperează setările anterioare.

**Source details and individual choices** arată ce a fost citit, numele de fonturi detectate și contrastul text/acțiune al previzualizării. De asemenea oferă **Choose individual items in the tray** și **Download design context**. Raportul JSON poartă observații, tokeni propuși și informații despre sursă; HTML/CSS-ul salvat include un SHA-256 al textului furnizat. Nu conține text brut al paginii și nu este o Content Credential semnată. Numele de fonturi sunt sugestii: Type rămâne locul unde alegi și instalezi fonturi.

Importurile PDF și celelalte fișiere de design își păstrează comenzile de revizuire existente. Elementele păstrate în **Tavă** nu schimbă nimic până sunt adăugate prin camera care deține acel tip de material.

`#/start?source=<kind>` deschide selectorul pe o sursă dată (`file`, `pdf`, `image`, `font`, `url`, `page`), iar `?import` îl deschide pe lista simplă.

## Mută un brand între dispozitive

**Export**, la baza barei laterale, scrie o singură arhivă **`LollyBrand-….lolly`** - tokenurile, fonturile, logo-urile și preferința de temă, cu un manifest de integritate pe care îl verifică la reintroducere. Versiunile web dinainte de 1.0.7 numeau aceeași arhivă `.zip`; acea ortografie veche este încă acceptată. Alături, **Tokenuri (.json)** scrie doar documentul simplu de tokenuri de design: fără fonturi, fără logo-uri, doar tokenurile, ceea ce citește de fapt un depozit de cod, un pas CI sau o altă unealtă de tokeni.

Aducerea uneia înapoi se face prin **Add from... → Design tokens or a design file** (mai sus), sau prin tragere directă în studio. Așa îți dă un coleg un brand, sau așa duci unul la o a doua instalare - fără cont, fără cloud. Pentru a aduce un brand din linia de comandă în schimb, vezi [`ingest:brand`](/info/configuration.html#brand-packs).

## Restaurează setări anterioare

Alege **Restore brand settings** la baza barei laterale, selectează un punct de control datat, apoi apasă **Restaurează**. Acesta restaurează culorile, setările de font și ceilalți tokeni de brand pentru brandul activ. Fișierele de font și imagine rămân neschimbate.

Lolly salvează setările tale curente ca **Before restore**, înainte de a aplica punctul de control. Alege acel punct de control pentru a inversa restaurarea, inclusiv după închiderea și redeschiderea browserului. Ultimele 20 de puncte de control sunt păstrate pe acest dispozitiv. Dacă stocarea nu poate fi citită sau setările curente nu pot fi salvate, dialogul raportează problema ca să poți încerca din nou.

## Versiuni

**Versions** la baza barei este locul unde un sistem de design încetează să mai fie o țintă mobilă. Publică una și obții o **copie permanentă, cu nume** păstrată pe acest dispozitiv: nu se mai schimbă niciodată după aceea, așa că un instrument care o fixează continuă să deseneze același lucru. Panoul rămâne ascuns până există ceva al tău de publicat, astfel încât un studio care nu publică niciodată nu vede niciodată aceste comenzi.

Trei lucruri de știut înainte să apeși orice, iar panoul le spune pe toate trei înainte de apăsare, nu după:

- **O versiune este permanentă.** Nu există încă ștergere, așa că panoul declară ce a fost păstrat și că rămâne păstrat, în loc să ofere un buton care minte.
- **Eliminările conduc cardul de compatibilitate.** Tokenurile adăugate și modificate sunt noutăți; unul *eliminat* este ceea ce strică un instrument, așa că este numit primul și numit exact ceea ce este.
- **Publicarea nu poate fi anulată; restaurarea poate.** *Restore latest from this version* este o modificare obișnuită a capului, așa că merge pe stiva de anulare a studioului, iar panoul îți oferă imediat **Undo**.

Poți **Publish only**, sau **Publish and make active** - diferența fiind dacă tool-urile și aplicația urmează de acum acea versiune sau continuă să urmeze ultima ta editare. **Follow the latest again** pune fiecare editare live în momentul în care e făcută. `#/start?area=versions` deschide panoul direct.

## Când brandul este fixat

Unele build-uri livrează un **sistem de design blocat**, cum ar fi SUSE Brand. Deschiderea lui arată o notă doar-pentru-citire cu **Fă o copie editabilă** și **Schimbare**. Culorile, fonturile și tokenii lui originali rămân intacte. Propriile tale sisteme locale rămân editabile, chiar și atunci când sistemul blocat a fost primul de pe dispozitiv. În Profile, **Deschide** selectează un sistem și îi deschide studioul; **Creează unul nou** creează un sistem local și îl deschide la `#/start` cu câmpul de nume focalizat.

## Ce urmează

- **[Using Lolly](/info/using.html)** - canvasul, salvarea, proiectele și Resursele.
- **[Design Tokens](/info/design-tokens.html)** - modelul de tokeni în care e exprimat brandul tău.
- **[Exporting & formats](/info/exporting.html)** - unități de tipar, CMYK și formatele în care se randează brandul tău.


## Găsește și compară un aspect

Deschide **Find a look** din Overview sau din lista de sisteme de design din Profile. Răsfoiește sistemele salvate pe acest dispozitiv și câteva exemple Lolly reutilizabile. Caută după nume, etichetă de culoare sau font declarat. **Closest to my current palette** sortează după similaritatea de culoare măsurată, familiile de fonturi potrivite decizând egalitățile; nu este un scor de calitate.

Selectează un aspect pentru a-l revizui, sau două pentru a le compara. Butonul de revizuire rămâne disponibil pe un ecran mic. Selectarea unui aspect nu schimbă nimic. **Use this saved system** comută prin registrul existent de sisteme de design. **Folosește aceste culori** aplică un exemplu prin fluxul obișnuit de punct de control și instalare, păstrând fonturile curente. **Restore brand settings** poate recupera aspectul anterior.

Sub **Details and design context**, sistemele salvate au **Search tags** editabile și o descărcare de context. Exemplele folosesc rețete de culoare originale Lolly; nu există o colecție de inspirație extrasă de la distanță și niciun cont necesar.

![Compară Sunroom și Orchard unul lângă altul înainte de a aplica oricare dintre sistemele de culoare.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Comparația păstrează ambele palete vizibile împreună. Revizuirea unui aspect nu schimbă nimic până alegi **Folosește aceste culori** sau **Use this saved system**.

## Citește dovezile sursei

Detaliile opționale ale revizuirii sursei arată tipografia, spațiile, padding-ul și valorile de colț, acolo unde au fost observate. HTML/CSS-ul salvat și citirile native ale site-urilor raportează declarații, care s-ar putea să nu fie folosite de pagina randată. Extensia de browser poate raporta stiluri măsurate dintr-un eșantion limitat de elemente vizibile, cu viewport-ul și preferința de culoare a browserului. Extensiile mai vechi funcționează în continuare cu stiluri declarate. Câmpurile lipsă spun **Not observed**.

Acestea sunt observații, nu setări automate de stil. Fișierele de font nu sunt preluate sau instalate de o scanare de referință, iar spațierea sursei nu îți înlocuiește tăcut propria spațiere. Numerele descriu apariții în eșantion, nu încredere sau calitate.

## Verifică o compoziție față de sistemul de design

În Design, deschide **Exportă**, apoi **Înainte să exporți**. Verificarea folosește aceeași versiune efectivă a sistemului de design ca și randarea. Compară culorile autorizate, aliasurile de tokeni, alegerile de font și ID-urile activelor de imagine. Valorile personalizate pot fi intenționate; o imagine din afara activelor de brand declarate este un element de revizuit, nu o imagine interzisă.

Acolo unde este disponibilă o sugestie concretă de culoare sau font, butonul ei schimbă doar acel strat. **Anulează** obișnuit restaurează valoarea originală. Straturile blocate sau modificate nu sunt suprascrise de o sugestie veche. Dovezile de sursă lipsă rămân separate de o potrivire. Contrastul randat și aranjarea textului sunt verificate de controalele existente montate. Degradeurile, efectele, conținutul unei unelte imbricate, drepturile și calitatea subiectivă nu sunt evaluate de comparația de brand. Verificările nu blochează Descarcă.

## Folosește contextul de design local

**Download design context** include documentul de tokeni, culorile rezolvate, familiile de fonturi declarate, ID-urile activelor, dovezile de sursă acolo unde sunt înregistrate, acoperirea și regulile explicite. Nu include fișierele de font sau dovada de proprietate. Revizuirea de referință include și tokenii propuși și observațiile ei.

CLI-ul poate citi oricare dintre descărcări fără un server:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` acceptă intrări Design cu un array `boxes` sau un document Design compilat. Raportează corecții propuse fără să modifice compoziția. Nu poate măsura aspectul browserului sau contrastul randat. Resursa MCP existentă **lolly://design-context** expune contextul sistemului efectiv prin procesul MCP local configurat; nu este nevoie de niciun serviciu găzduit nou sau cheie API.
