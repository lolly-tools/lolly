# Batch și Multi-edit

Apar două sarcini când faci des același fel de fișier. Uneori ai nevoie de multe versiuni ale unui design: un card în o duzină de limbi sau fiecare dimensiune a unui banner. Alteori ai mai multe designuri salvate diferite și vrei ca o singură schimbare să le ajungă pe toate, precum o dată nouă sau un titlu nou.

**Batch** face prima sarcină, iar **Multi-edit** o face pe a doua. Ambele rulează pe dispozitivul tău și exportă prin aceeași cale de randare ca instrumentele însele.

::: cols
## Batch

- Un șablon, multe rânduri. Fiecare rând este un set de intrări și face un fișier.
- Completează rândurile tastând, lipind dintr-o foaie de calcul sau importând un CSV.
- Fără limită de rânduri; se afișează 50 pe pagină.
- Se deschide din **Batch** în antetul Projects (`#/batch`).

## Multi-edit

- Două până la opt designuri salvate diferite, unul lângă altul, ca niște carduri live.
- O singură bară laterală editează intrările pe care le au în comun, apoi pe cele proprii ale fiecărui card.
- Fiecare design se salvează înapoi unde a fost.
- Se deschide din **Edit together** în bara de selecție din Projects.
:::

## Fă multe versiuni ale unui design

Deschide **Projects** și apasă **Batch** în antetul lui. Grila pornește cu un rând: alege în el un șablon, apoi duplică rândul sau lipește date din foaia ta de calcul. Deschis din interiorul unui dosar, Batch te readuce în acel dosar.

![Batch pe o grilă nouă: numele fișierului și uneltele de rând sus, iar lista de șabloane a primului rând deschisă pe instrumentele pe care le poți alege](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Completează rândurile.** Tastează într-o celulă sau lipește un bloc direct din Excel, Google Sheets sau altă foaie de calcul. **Import CSV** adaugă rânduri sau înlocuiește batch-ul. Când lipești într-o celulă care conține setări de export, Lolly întreabă ce intrare umple fiecare coloană lipită. **Export CSV** scrie grila înapoi. Deschide **Columns** sub grilă ca să arăți mai multe intrări sau lățimea, înălțimea, unitatea și DPI per rând.

**Setează ieșirea.** Bara de unelte setează numele fișierului zip, **Default format**, unitățile și DPI pentru fiecare rând. Meniul de format este lista grupată din panoul de export, care arată formatele oferite de catalog și acceptate de browserul tău. Un rând cu propriul format, propria dimensiune sau propriul nume de fișier își păstrează setarea.

**Randare.** **Render all** exportă fiecare rând într-un singur `.zip`. Selectează mai întâi rânduri, iar **Render selected**, **Export selected CSV** și **Print selected rows** acționează doar pe acelea; șterge selecția ca să lucrezi din nou pe tot batch-ul. **Print sheet** așază rândurile pe o foaie imprimabilă. **Batch activity** raportează fiecare import și randare și se restrânge ca să dea tabelului mai mult loc.

**Păstrează batch-ul.** **Sessions** salvează întreaga grilă ca sesiune batch cu nume, care se redeschide mai târziu din Projects. Sessions salvează mereu fiecare rând, indiferent ce este selectat. **Folders…** din același meniu deschide un dosar Projects întreg ca rânduri, câte unul pe sesiune salvată, cu fiecare nume de fișier purtând calea dosarului.

::: details Selectarea rândurilor și a celulelor
Selectează rânduri cu casetele lor de bifare sau Shift-clic pe o casetă pentru un interval. Caseta din antet selectează pagina curentă, iar **Select all *N* rows** ia și rândurile de pe alte pagini. Selecțiile rămân când treci între pagini. **Edit input**, **Duplicate** și **Remove** acționează pe rândurile selectate, iar **Undo remove** restaurează rândurile eliminate ultima dată. Dintr-o celulă în focus, Shift+Space selectează acel rând, iar Escape șterge selecția.

Trage peste celule, Shift-clic pe o celulă sau folosește Shift+tastele săgeți ca să selectezi un dreptunghi. **Copy cells**, sau Ctrl+C / Command+C, copiază valorile pentru o foaie de calcul. Ctrl+A / Command+A dintr-o celulă în focus selectează fiecare coloană vizibilă de pe fiecare pagină; dintr-o casetă de rând, aceeași scurtătură selectează fiecare rând. Selectarea celulelor lasă rândurile bifate bifate. Fă dublu clic pe o celulă sau apasă Enter ca să-i editezi textul. Lipește un dreptunghi din clipboard sau lipește o singură valoare ca să umpli fiecare celulă selectată; celulele goale și textul pe mai multe rânduri își păstrează pozițiile.
:::

### Colourway-uri și teme pe rând

Fiecare rând își păstrează propriile alegeri de temă: deschis sau închis și un colourway, când sistemul de design are. Un rând deschis din Projects, dintr-un dosar sau dintr-un batch salvat randează în alegerile în care a fost salvată sesiunea lui, iar previzualizarea lui se deschide în ele. Foaia de tipar, un rând duplicat și un rând completat le păstrează pe toate.

Un CSV poartă alegerile într-o coloană `_themes` după coloanele de dimensiune, cu același JSON ca parametrul de link `_themes`, de exemplu `{"":"dark","colourway":"beach"}`. O celulă goală sau `{}` înseamnă valorile implicite ale sistemului de design. Coloana este scrisă doar când vreun rând are alegeri, deci un batch fără ele exportă același CSV ca înainte. La import, o celulă care nu conține alegeri de temă valide este listată ca problemă, iar rândul ei randează în valorile implicite. Grila nu are încă un control pentru schimbarea alegerilor unui rând, deci setează-le în CSV sau în sesiunea salvată.

### Batch sau Render folder

Batch face multe variante ale unui șablon. Ca să randezi din nou sesiuni deja salvate, selectează-le în Projects și folosește **Render selection**, sau **Render folder** pentru un dosar întreg; [Găsește și recuperează-ți munca](/info/find-your-work.html#find-something-you-saved) le acoperă pe amândouă.

## Editează mai multe designuri salvate împreună

Bifează între două și opt sesiuni salvate în **Projects** și alege **Edit together** din bara de selecție. Se deschid unul lângă altul ca niște carduri live la `#/multi?s=<slot>,<slot>…`. Fiecare card este o randare reală a sesiunii lui, deci ce vezi este ce se va exporta.

O singură bară laterală le conduce pe toate:

- <!--i:sliders--> **Shared** vine primul: fiecare intrare pe care două sau mai multe dintre sesiuni o declară la fel (același id, același tip, aceleași restricții, regula pe care o folosește grila batch pentru coloanele ei). Editează o dată un control comun și valoarea ajunge în fiecare sesiune care declară intrarea, live pe fiecare card. Două sesiuni ale aceluiași instrument au totul în comun; două instrumente diferite au în comun doar intrările pe care le au la fel.
- <!--i:document--> Sub el, **un card pliat pe sesiune** conține toate intrările proprii ale sesiunii, la fel de complete ca bara laterală a instrumentului, cu un bloc compact de export: **Format**, **W** / **H**, **Unit**, **DPI** și **Download**. Acel Download salvează mai întâi sesiunea, apoi randează fișierul cu același nume de fișier, format și Content Credentials pe care le-ar avea din instrument.
- <!--i:search--> **Filter inputs…** din partea de sus îngustează controalele de pe fiecare card deodată, deci poți ajunge la „titlu” în opt sesiuni fără să derulezi.

Fă clic pe orice card (sau apasă Enter pe el) ca să deschizi cardul lui din bara laterală. **Save all** scrie fiecare sesiune înapoi în propriul slot. **Download all** salvează mai întâi, apoi randează tot setul într-un singur zip, la fel ca **Render selection** din Projects, cu blocarea opțională cu parolă oferită pe drum.

Fiecare card desenează în alegerile de temă ale propriei sesiuni, inclusiv un instrument plasat în interiorul designului. Cardurile cu aspecte diferite stau unul lângă altul, în timp ce aplicația din jur își păstrează propriile culori, iar **Save all**, descărcările, **Batch grid** și **Send to Print Sheet** păstrează alegerile fiecărei sesiuni.

### Limite

- **Maximum opt.** Fiecare card montează propriul runtime live, iar opt este numărul care rămâne receptiv. Un link care cere mai multe sau o sesiune care nu mai există spune asta în loc să se încarce pe jumătate.
- **Linkul este local.** Numește sloturile tale salvate, deci redeschide acel set pe acest dispozitiv. Nu este un link de partajare.
- **Pentru ceva mai mare,** alege **Edit as sheet** în aceeași bară de selecție. Deschide întreaga selecție ca rânduri în grila batch (`#/batch?s=…`), fără limită de dimensiune și fără regula aceluiași instrument. Dosarele rămân în afara ambelor: deschide un dosar în grilă cu **Sessions → Folders…** sau randează unul cu **Render folder** în Projects.
- **Căutarea nu ajunge în Multi-edit.** Este singura vedere despre care bara de căutare nu știe.

## Ce urmează

- **[Exportă un fișier](/info/exporting.html)**: formatele, dimensiunile și setările de tipar pe care le poate folosi fiecare rând.
- **[Șabloane](/info/templates.html)**: puncte de pornire care fac un prim rând bun.
- **[Găsește și recuperează-ți munca](/info/find-your-work.html)**: Projects, dosare și randarea a ce ai salvat.
