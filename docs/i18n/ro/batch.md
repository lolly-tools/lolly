# Lolly Batch și Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** creează multe versiuni ale aceluiași design, precum un card într-o duzină de limbi sau toate dimensiunile unui banner. **Lolly Multi-edit** face aceeași schimbare, precum o dată sau un titlu nou, în mai multe designuri salvate diferite.

Ambele rulează pe dispozitivul tău și exportă prin aceeași cale de randare ca instrumentele.

::: cols
## Batch

- Un șablon, multe rânduri. Fiecare rând este un set de intrări și produce un fișier.
- Completează rândurile tastând, lipind dintr-o foaie de calcul sau importând un CSV.
- Fără limită de rânduri; se afișează câte 50 pe pagină.
- Se deschide din **Lolly Batch** în antetul Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Între două și opt designuri salvate diferite, alăturate ca niște carduri live.
- O singură bară laterală editează intrările comune, apoi pe cele proprii fiecărui card.
- Fiecare design se salvează înapoi în locul de unde a venit.
- Se deschide din **Edit together** în bara de selecție Projects.
:::

<!--i:eti-table-->
## Creează multe versiuni ale aceluiași design

Deschide vederea **Projects** și apasă **Batch** în antetul ei. Grila începe cu un rând. Alege un șablon în acel rând, apoi duplică rândul sau lipește date dintr-o foaie de calcul. Deschis dintr-un dosar, Batch te readuce la acel dosar.

![Batch cu o grilă nouă: numele fișierului și instrumentele pentru rânduri sus, iar lista de șabloane a primului rând este deschisă la instrumentele pe care le poți alege](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Completează rândurile.** Tastează într-o celulă sau lipește un bloc din Excel, Google Sheets ori altă foaie de calcul. **Import CSV** adaugă rânduri sau înlocuiește lotul. Când lipești într-o celulă care conține setări de export, Lolly întreabă ce intrare completează fiecare coloană lipită. **Export CSV** scrie grila într-un fișier. Deschide **Columns** sub grilă ca să arăți mai multe intrări sau lățimea, înălțimea, unitatea și DPI pentru fiecare rând. Fereastra **Fill** a unei coloane de numere, text sau opțiuni are și o secțiune **Design token** care leagă un token în toate rândurile coloanei ([Leagă mai multe documente deodată](/info/token-workflows.html#link-many-documents-at-once)).

**Setează ieșirea.** Bara de instrumente setează numele fișierului zip, **Default format**, unitățile și DPI pentru fiecare rând. Meniul de format este lista grupată din panoul de export, cu formatele oferite de catalog și acceptate de browserul tău. Un rând cu propriul format, propria dimensiune sau propriul nume de fișier își păstrează setarea.

**Randează.** **Render all** exportă fiecare rând într-un singur `.zip`. Cu rânduri selectate, **Render selected**, **Export selected CSV** și **Print selected rows** acționează doar asupra acelor rânduri. Golește selecția ca să lucrezi din nou pe întregul lot. **Print sheet** așază rândurile pe o foaie de tipărit. **Batch activity** raportează fiecare import și randare și se poate plia.

**Păstrează lotul.** **Sessions** salvează fiecare rând al grilei ca sesiune de lot cu nume, indiferent ce este selectat. Sesiunea se redeschide din Projects. **Folders…** din același meniu deschide un dosar Projects ca rânduri, câte unul pentru fiecare sesiune salvată; fiecare nume de fișier include calea dosarului său.

::: details Selectarea rândurilor și celulelor
Selectează rânduri cu casetele lor de bifare sau fă Shift-clic pe o casetă de bifare pentru un interval. Caseta din antet selectează pagina curentă, iar **Select all *N* rows** include și rândurile de pe alte pagini. Selecțiile rămân când treci de la o pagină la alta. **Edit input**, **Duplicate** și **Remove** acționează asupra rândurilor selectate, iar **Undo remove** restaurează ultimele rânduri eliminate. Dintr-o celulă cu focus, Shift+Space selectează acel rând, iar Escape golește selecția.

Trage peste celule, fă Shift-clic pe o celulă sau folosește Shift+tastele săgeți ca să selectezi un dreptunghi. **Copy cells** sau Ctrl+C / Command+C copiază valorile pentru o foaie de calcul. Ctrl+A / Command+A dintr-o celulă cu focus selectează fiecare coloană vizibilă de pe fiecare pagină; din caseta de bifare a unui rând, aceeași scurtătură selectează fiecare rând. Selectarea celulelor lasă bifate rândurile bifate. Fă dublu clic pe o celulă sau apasă Enter ca să-i editezi textul. Lipește un dreptunghi din clipboard sau lipește o singură valoare ca să completezi fiecare celulă selectată; celulele goale și textul pe mai multe linii își păstrează pozițiile.
:::

### Colourway-uri și teme pentru fiecare rând

Fiecare rând își păstrează propriile alegeri de temă: deschis sau închis și un colourway când sistemul de design le oferă. Un rând deschis din Projects, dintr-un dosar sau dintr-un lot salvat se randează și se previzualizează cu alegerile cu care a fost salvată sesiunea lui. Foaia de tipărit, un rând duplicat și un rând completat le păstrează.

Un CSV păstrează alegerile într-o coloană `_themes` după coloanele de dimensiune. Coloana are același JSON ca parametrul de link `_themes`, de exemplu `{"":"dark","colourway":"beach"}`. O celulă goală sau `{}` înseamnă valorile implicite ale sistemului de design. Coloana este scrisă doar când cel puțin un rând are alegeri. La import, o celulă care nu conține alegeri valide de temă este listată ca problemă, iar rândul ei se randează cu valorile implicite.

::: note Setează alegerile unui rând în CSV
Grila nu are încă un control pentru schimbarea alegerilor unui rând, deci setează-le în CSV sau în sesiunea salvată.
:::

### O limbă pentru fiecare rând

Un instrument care tipărește propriile formulări, precum Certificate, poate primi o coloană `language` cu un cod scurt de limbă precum `de`, `ja` sau `ar`. Fiecare rând își tipărește apoi formulările și data în acea limbă. Rândurile în arabă și urdu sunt aranjate de la dreapta la stânga. O celulă goală urmează limba aplicației. O limbă pentru care Lolly nu are încă o traducere se tipărește în engleză, inclusiv data, deci un certificat nu este niciodată tradus pe jumătate.

### Batch sau Render folder

Ca să randezi din nou sesiuni deja salvate, selectează-le în Projects și folosește **Render selection** sau **Render folder** pentru un dosar întreg. [Găsește și recuperează-ți munca](/info/find-your-work.html#find-something-you-saved) le acoperă pe amândouă.

<!--i:eti-layers-->
## Editează împreună mai multe designuri salvate

Bifează între două și opt sesiuni salvate în **Projects** și alege **Edit together** din bara de selecție. Se deschid alăturat ca niște carduri live la `#/multi?s=<slot>,<slot>…`. Fiecare card este o randare reală a sesiunii lui și arată ce se va exporta.

O singură bară laterală le controlează pe toate:

- <!--i:sliders--> **Shared** apare primul: fiecare intrare pe care două sau mai multe sesiuni o declară în același fel (același id, tip și aceleași constrângeri, regula folosită de grila de lot pentru coloane). O schimbare a unui control comun ajunge la fiecare sesiune care declară intrarea, live pe fiecare card. Două sesiuni ale aceluiași instrument au totul în comun; două instrumente diferite au doar intrările comune. Meniul **Input actions** al cardului Shared leagă un token de design în fiecare sesiune care declară intrarea.
- <!--i:document--> Sub cardul Shared, **un card pliat pentru fiecare sesiune** conține toate intrările proprii acelei sesiuni, ca în bara laterală a instrumentului, cu un bloc compact de export: **Format**, **W** / **H**, **Unit**, **DPI** și **Download**. Acel Download salvează mai întâi sesiunea, apoi randează fișierul cu același nume, format și aceleași Content Credentials pe care le-ar avea din instrument.
- <!--i:search--> **Filter inputs…** din partea de sus restrânge controalele de pe toate cardurile deodată.

Fă clic pe orice card (sau apasă Enter pe card) ca să deschizi cardul acelei sesiuni în bara laterală. **Save all** scrie fiecare sesiune înapoi în propriul slot. **Download all** salvează mai întâi, apoi randează setul într-un singur zip, ca **Render selection** din Projects, și oferă blocarea opțională cu parolă.

Fiecare card desenează cu alegerile de temă ale propriei sesiuni, inclusiv un instrument plasat în design. Aplicația din jurul cardurilor își păstrează propriile culori. **Save all**, descărcările, **Batch grid** și **Send to Print Sheet** păstrează alegerile fiecărei sesiuni.

### Limite

- **Cel mult opt.** Fiecare card își încarcă propriul mediu de execuție live, iar opt carduri răspund prompt. Un link care cere mai multe sau o sesiune care nu mai există spune asta și nu se încarcă pe jumătate.
- **Linkul este local.** Numește propriile tale sloturi salvate și redeschide acel set pe acest dispozitiv. Nu este un link de partajare.
- **Pentru un set mai mare,** alege **Edit as sheet** în aceeași bară de selecție. Deschide selecția ca rânduri în grila de lot (`#/batch?s=…`), fără limită de dimensiune și fără regula aceluiași instrument. Dosarele rămân în afara ambelor: deschide un dosar în grilă cu **Sessions → Folders…** sau randează unul cu **Render folder** în Projects.
- **Căutarea nu ajunge la Lolly Multi-edit.** Este singura vedere pe care bara de căutare nu o acoperă.

<!--i:eti-map-pin-->
## Unde mergi mai departe

- **[Exportă un fișier](/info/exporting.html)**: formatele, dimensiunile și setările de tipar pe care le poate folosi fiecare rând.
- **[Șabloane](/info/templates.html)**: puncte de pornire potrivite pentru un prim rând.
- **[Găsește și recuperează-ți munca](/info/find-your-work.html)**: Projects, dosare și randarea muncii salvate.
