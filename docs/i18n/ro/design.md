# Design: canvasul liber

<a id="design-the-free-canvas"></a>

Design este instrumentul pentru layouturi pe care niciun șablon nu le acoperă: un afiș de la zero, un deck de diapozitive, o piesă de mișcare cu coloană sonoră. În loc de un formular cu controale, primești un canvas de casete pe care le tragi, redimensionezi, rotești și în care scrii. Exportă prin aceeași cale de randare ca orice alt instrument, deci ce vezi pe canvas este fișierul pe care îl primești.

Această pagină parcurge canvasul de la prima casetă până la un deck terminat: fereastra, modelarea casetelor, desenarea propriilor forme, plasarea scenelor 3D și a altor instrumente, adăugarea timpului, verificarea rezultatului și prezentarea deck-ului terminat. [Folosirea Lolly](/info/using.html) acoperă ce are Design în comun cu fiecare instrument, precum salvarea și partajarea.

![Canvasul liber al Design - planșa de lucru și masa de lucru din jurul ei](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Fereastra Design

**Bara de sus** începe cu **Home**, **File menu** și numele documentului (fă clic pe nume ca să redenumești documentul). La mijloc sunt **Undo**, **Redo**, **History**, controalele de zoom (cu **Fit all** și **Fit artboard**) și comutatoare pentru **Timeline**, **Navigator** și **Inspector**. În dreapta stau **Share**, **Present** și **Export**. Pe telefon, butoanele mai rar folosite trec în **More actions**.

**Bara de unelte** de pe margine conține meniul Lolly și uneltele cu care desenezi: **Pointer**, **Add a box**, **Pen** (butonul lui îl împarte cu **Instrumentul creion**), **Edit points**, **Line**, apoi butoanele Timeline, Artboards și Auto-arrange.

![Bara de instrumente a canvasului liber: un mâner de tragere, meniul Lolly, apoi Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards și Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Canvasul funcționează ca o masă de lucru a designerului în jurul planșei:

- **Parchează casete în afara planșei.** Trage o casetă dincolo de marginea cadrului și rămâne vizibilă și selectabilă. Tot ce e în afara cadrului este estompat, iar cadrul își păstrează umbra ca să marcheze unde începe fișierul.
- **Doar planșa se exportă.** Tot ce e în afara cadrului sau partea unei casete care depășește marginea este tăiată din ieșire, atât în formate raster, cât și vectoriale.
- **Mărește distanța dincolo de Fit** ca să vezi tot ce ai parcat.
- **Redimensionează planșa** schimbând dimensiunea de export. Casetele își păstrează pozițiile, deci poți reîncadra un layout în jurul conținutului existent.

![Scena de editare: planșa în prim-plan, bara de unelte în stânga și HUD-ul de zoom în colț](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator și Inspector

**Navigator** listează fiecare planșă (sub titlul **Artboards** sau **Slides** într-un deck) ca un grup pliabil al **Layers**-urilor ei. Selectează numele unei planșe ca să sari acolo, extinde-o ca să selectezi sau să reordonezi straturile ei și folosește tastele săgeți ca să te miști prin listă; Stânga revine la titlul planșei. **Pages** grupează planșele în pagini cu nume, iar alegerea unei pagini schimbă doar ce planșe arată editorul.

**Inspector** pune primele controalele de text sau imagine ale obiectului selectat. Chip-urile de opțiuni acoperă alegerile rapide, iar **Advanced** conține detaliile de stil. Pe telefon, Inspectorul și lista de straturi împart un singur panou care coboară de sub bara de sus, același panou în care își ține controalele orice alt instrument. **Inspect** și **Layer/Page** din bara de jos deschid panoul pe fila lor. Trage mânerul de pe marginea de jos, sau atinge mânerul, ca să muți panoul între o bandă cu cele două file, jumătate din ecran și aproape tot ecranul. La jumătate, canvasul de sub panou arată selecția ta. Escape strânge panoul înapoi la bandă și îți păstrează selecția.

![Secțiunea Document din Inspector: filele Selection și Canvas, apoi Dimensions și Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Redimensionează, scalează și rotește

Selectează un obiect, apoi trage un mâner ca să-i schimbi dimensiunea sau trage mânerul rotund de sub selecție ca să rotești obiectul. O tragere de dimensiune funcționează în unul din două moduri:

- **Resize**, implicit, schimbă doar caseta. Textul se reîmpachetează la noua dimensiune, iar dimensiunea fontului, grosimea conturului, raza colțurilor și efectele rămân cum erau.
- **Scale** mărește sau micșorează întregul obiect cu tot conținutul: dimensiunea fontului, conturul, raza colțurilor, umbra, estomparea, padding-ul și spațierea se schimbă toate cu aceeași proporție.

Apasă `K` ca să pornești sau să oprești Scale. Fără tastatură, alege **Scale mode** în meniul Lolly sau ține apăsat butonul **Pointer** de pe bară (sau fă clic dreapta pe buton) și alege **Scale**; pe un ecran tactil, bara de obiect are și ea un comutator Scale. Cât Scale este pornit, butonul Pointer arată pictograma Scale, iar fiecare mâner are un punct la mijloc. `V` sau **Escape** revine la Resize și îți păstrează selecția. Fiecare document se deschide cu Scale oprit, deci nimeni nu scalează contururile din greșeală.

**Scalare după un număr.** Cu Scale pornit sau cu mai multe obiecte selectate, fă clic pe afișajul din bara de obiect ca să deschizi fereastra **Scale**. Tastează un procent, o lățime sau o înălțime, alege punctul care rămâne fix pe grila 3 x 3 și alege **Apply**. Fiecare scalare este un pas undo.

**Mai multe obiecte.** O selecție de mai multe obiecte are mânere pe margini, nu doar în colțuri. Cât fiecare obiect este drept sau rotit cu sfertulețe întregi de tură, iar selecția nu conține grup sau cerc, tragerea unui colț schimbă liber lățimea și înălțimea. Altfel, selecția își păstrează proporțiile, iar afișajul adaugă **Proportional**. Cât tragi, o mică etichetă arată dimensiunea sau procentul în modul Scale.

**Răstoarnă o selecție.** Fă clic dreapta și alege **Flip horizontal** sau **Flip vertical** ori apasă `Shift+H` sau `Shift+V` (Shift, pentru că un `V` simplu este Pointer). Oglindirea este o transformare reală, deci SVG-ul, PDF-ul și PNG-ul exportate păstrează răsturnarea.

**Tastele pe care le ții în timpul unei trageri** au efect în clipa în care le apeși sau le eliberezi; foaia de scurtături (`?`) le listează și ea.

| Ține | Redimensionare sau scalare | Rotire | Mutare |
|---|---|---|---|
| **Shift** | Păstrează proporțiile (Scale o face mereu) | Rotește în pași de 15 grade | Nicio schimbare |
| **Alt** (Option) | Lucrează din centru | Rotește liber | Oprește snapping-ul și grila |
| **Cmd/Ctrl** | Oprește snapping-ul și grila | Rotește liber | Oprește snapping-ul și grila |

Fără nicio tastă ținută, o rotire este trasă la cel mai apropiat multiplu de 15 grade când ajunge la 4 grade de el. Planșele nu se rotesc, deci nu au mâner de rotire.

::: details Mânere, zone de prindere și atingere
**Prinde de oriunde pe margine.** Fiecare latură a unei selecții este o fâșie de redimensionare pe toată lungimea ei, iar cu un mouse sau un stilou există o zonă de rotire chiar în afara fiecărui colț. Cursorul arată ce va face o tragere. O apăsare într-o fâșie sau zonă devine redimensionare sau rotire doar după ce începi să tragi, deci un clic simplu selectează ca înainte. Un obiect blocat nu are mânere, fâșii sau zone.

**Obiectele mici rămân mutabile.** Pe un obiect de 25 de pixeli de ecran sau mai puțin, mânerele din mijloc se ascund, iar celelalte se mută puțin în afara conturului, deci o apăsare pe obiect mută obiectul. La 10 pixeli sau mai puțin dispar și mânerele de colț, iar o linie subțire păstrează un mâner la fiecare capăt. O apăsare chiar lângă o linie subțire sau un obiect minuscul, departe de mânere, mută obiectul.

**Zone mari de prindere.** Pe un ecran tactil, fiecare zonă de colț este un sfert din lățimea și înălțimea selecției pe ecran, între 24 și 44 de pixeli, iar fiecare zonă de latură acoperă porțiunea dintre două colțuri. Când selecția este prea mică pentru asta, zonele se mută în afara conturului. Zona de sub cursor sau deget este umbrită. Ca să ai aceleași zone cu un mouse sau un stilou, activează **Large grab areas** în meniul Lolly; setarea rămâne pe acest dispozitiv.

**Două degete pe o selecție.** Pe un ecran tactil, pune două degete pe un obiect selectat: ciupește pentru a scala, răsucește pentru a roti sau mută ambele degete pentru a căra selecția, totul ca un singur pas undo. Cu Scale pornit, o ciupire scalează și conținutul; cu Scale oprit, redimensionează proporțional. O răsucire se fixează la cei mai apropiați 15 grade când e aproape, iar o mișcare cu două degete nu se fixează niciodată. Primul deget trebuie să aterizeze pe selecție, iar al doilea trebuie să urmeze repede, pe selecție sau chiar în afara marginii ei. Două degete oriunde în altă parte fac zoom și deplasează vederea, la fel ca două degete pe o selecție care conține o planșă sau un obiect blocat, acoperă cea mai mare parte a vederii sau trece de marginea ei.
:::

## Desenează-ți propriile forme

Casetele, cercurile și cadrele rotunjite acoperă cele mai multe layouturi. Pentru orice altă formă, desenează una: butonul **Pen** de pe bară (sau `P`) te pune în modul desen. Patru taste te mută între moduri: `V` pentru Pointer, `P` pentru Pen, `Shift C` pentru **Instrumentul creion** și `N` pentru **Edit points**. Pointer este mereu ieșirea.

- **Fă clic** ca să plasezi un punct. La tipul de curbă implicit, **clic și tragere** scoate mânerele punctului ca să facă o curbă; ține **Alt** când dai clic pentru un colț dur. (La celelalte tipuri de curbă fiecare punct este un colț, iar o tragere nu face nimic.)
- Ține apăsat **Shift** când dai clic, iar segmentul nou pleacă din punctul dinainte la un multiplu de 15 grade, deci liniile orizontale, verticale și la 45 de grade ies exacte. Shift cât tragi un mâner îl mută în același fel, în trepte.
- Punctele se fixează pe planșă, pe celelalte casete și pe celelalte puncte ale aceleiași căi pe măsură ce le plasezi, deci un punct se aliniază cu unul plasat mai devreme. Alt suspendă grila cât desenezi, iar apoi, cât tragi un punct, suspendă și grila, și marginile.
- **Fă clic pe primul punct** ca să închizi forma. Altfel apasă **Enter**, fă dublu clic sau schimbă unealta, iar desenul este păstrat.
- **Escape** funcționează un pas pe rând: prima apăsare abandonează desenul, a doua părăsește pen-ul.
- **Delete**, sau Undo (`⌘ Z` ori `Ctrl Z`), în timp ce desenezi elimină ultimul punct.

**Continuă o cale deschisă.** Cu Pen pornit, apasă pe oricare capăt al unei căi deschise și desenezi din nou acea cale: fiecare clic adaugă un punct după acel capăt sau în fața primului punct când ai pornit de la început. Enter păstrează rezultatul, iar Escape lasă calea exact cum era. Calea rămâne aceeași casetă, cu umplerea, conturul și vârfurile de săgeată, iar un singur undo o aduce înapoi. Delete anulează doar punctele pe care le-ai adăugat. O formă închisă, o linie atașată unei casete și o cale cu mai multe părți nu au capăt liber din care să continui.

**Desenează liber cu Instrumentul creion.** Apasă `Shift C` sau ține apăsat butonul **Pen** de pe bară (sau fă clic dreapta pe buton) și alege **Instrumentul creion**; butonul arată apoi Instrumentul creion până când alegi din nou Pen. Instrumentul creion înregistrează trasul cât tragi. Când dai drumul, Lolly netezește trasul în câteva puncte cu mânere Bezier, păstrează cotiturile ascuțite ca colțuri și ține curba la câțiva pixeli de ecran de locul pe unde a mers mâna ta. Un traseu care se termină aproape de început se închide. Rezultatul este o cale obișnuită, cu aceeași vopsea ca o cale cu Pen, iar punctele ei se pot edita după aceea.

Rezultatul este o casetă obișnuită. Mută, redimensionează, rotește, grupează, aliniază, reordonează, umple, umbrește sau estompează calea ca orice altă casetă. Prima cale primește umplerea și conturul pe care brandul tău le dă unei căi, iar fiecare cale nouă de după primește ce ai folosit ultima dată. Într-un instrument al cărui brand nu setează nimic pentru căi, o cale nouă are contur în culoarea cu care ai desenat, deci forma nu este niciodată invizibilă.

**Editează din nou punctele.** Fă dublu clic pe formă sau folosește **Edit points** din bara de obiect. Trage un punct ca să-l muți, trage un mâner ca să reorientezi curba, fă clic pe curbă ca să inserezi un punct sau trage o casetă în jurul mai multor puncte și apasă Delete. O cale păstrează mereu cel puțin două puncte.

- Ține apăsat **Shift** cât tragi un punct, iar unghiul lui față de următorul punct al căii care nu se mișcă merge în trepte de 15 grade. Shift cât tragi un mâner îl rotește în trepte în jurul punctului lui. Shift la clic adaugă în continuare un punct sau un mâner la selecție; treptele încep odată ce tragi.
- Un punct tras se fixează pe planșă, pe celelalte casete și pe celelalte puncte ale căii. Ține apăsat Alt ca să-l plasezi liber.
- Fă clic pe un mâner ca să-l selectezi, apoi apasă **Delete** ca să-l tragi înapoi pe punctul lui. Acea parte a punctului devine un colț, fără mâner care să tragă curba. Cu puncte selectate, Delete elimină punctele ca înainte.

**Spline type** decide ce fel de curbă trece prin punctele tale:

| Tip | Ce face |
|---|---|
| **Smooth (auto)** | Implicit. Își calculează singur lungimile mânerelor, deci clicurile simple dau o curbă netedă. Un mâner pe care îl setezi fixează direcția, iar curba își păstrează lungimea. |
| **Bezier handles** | Pen-ul clasic: controlezi fiecare mâner, iar inserarea unui punct nu mută niciodată curba. |
| **Through the points** | Trece exact prin fiecare punct, fără mânere. |
| **B-spline** | Curge în apropierea punctelor, nu prin ele, pentru o linie mai blândă. |
| **Straight lines** | O poligonală. |

Comutarea unei căi existente la un tip care își calculează singur mânerele întreabă mai întâi, pentru că lungimile de mâner setate de tine nu se pot recupera; comutarea la **Bezier handles** este mereu fără pierderi. În timpul desenului comutarea se aplică imediat, iar mânerele scoase se pierd.

Fiecare punct poartă și o regulă de continuitate, arătată de forma lui: pătrat pentru **Corner** (mânerele se mișcă independent), rotund pentru **Smooth** (mânerele rămân în linie) și rotund cu inel pentru **Symmetric** (în linie și de lungime egală). Setează regula pentru punctele selectate și curba urmează imediat.

![Două căi cu penița randate direct dintr-un link: o curbă în S conturată și o formă închisă, umplută](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

O cale desenată călătorește într-un link de partajare ca orice altă casetă și se randează la fel din linia de comandă.

## Combină forme

Selectează două sau mai multe forme, fă clic dreapta pe canvas (atingere cu două degete pe tactil) și alege:

- **Union** le unește într-o singură formă cu vopseaua celei din vârf.
- **Subtract** taie tot ce e deasupra din forma de jos.
- **Intersect** păstrează doar suprapunerea.
- **Exclude** păstrează tot, în afară de suprapunere.

Încă trei acționează pe o singură formă. **Outline stroke…** transformă un contur într-un contur umplut de aceeași grosime. **Offset path…** mărește conturul spre exterior sau, cu un număr negativ, îl micșorează spre interior. **Simplify** reconstruiește o cale cu mai puține segmente pe același contur.

![O semilună și un inel cu o gaură reală, ambele produse de Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Rezultatul este o cale nouă pe care o poți edita în continuare cu pen-ul, stocată ca simple curbe Bezier, deci tipul original de spline nu se păstrează. Găurile sunt găuri reale: controlul **Fill rule** din panoul de contur decide dacă contururile suprapuse umplu (*non-zero*) sau perforează (*even-odd*). Operațiile refuză, nu distrug: dacă ceri intersecția a două forme care nu se suprapun, nu se schimbă nimic. Casetele de text și imagine nu au contur, deci sunt lăsate neatinse.

## Trasează o imagine

Selectează o imagine, dă clic dreapta pe ea și alege **Trasează imaginea…** ca să transformi poza în forme editabile. Alege un preset și apasă **Trasează**:

- **Logo** găsește câteva culori plate și păstrează margini clare, cercuri și linii exacte. Refuză o imagine cu gradienți sau tonuri de fotografie și îți spune asta.
- **Ilustrație** trasează mai multe culori ca forme pline, pentru grafică plată sau o imagine posterizată.
- **Desen liniar** trasează liniile închise de pe o pagină deschisă ca forme negre.
- **Linie centrală** trasează liniile închise ca trasee simple, ca să le poți schimba grosimea după aceea.

Formele sunt adăugate ca grup chiar deasupra imaginii, care rămâne unde este. Ascunde sau șterge imaginea ca să vezi doar traseele. Trasarea rulează pe dispozitivul tău ca o sarcină în fundal, cu un buton Anulează, și nu se încarcă nimic. O imagine de 1500 de pixeli durează de obicei între o secundă și câteva secunde, iar o fotografie încărcată durează mai mult.

Trasarea urmează ce arată caseta, deci o imagine tăiată (Cover) trasează doar partea vizibilă. Se aplică aceste limite:

- Imaginile sunt micșorate la cel mult 1500 de pixeli pe latura lungă înainte de trasare, deci marginile sunt plasate la o fracțiune din acea dimensiune, nu din cea a originalului.
- O trasare creează cel mult 1.500 de forme și 60.000 de puncte. O fotografie depășește de obicei limita, iar Design spune asta fără să schimbe nimic. Încearcă Logo sau Desen liniar ori o imagine mai simplă.
- Gradienții devin benzi de culoare plată, iar umbrele fine devin forme cu margini dure.
- Raza colțurilor, o mască de formă și un efect de pe caseta imaginii nu se aplică traseelor.
- Aceeași imagine și același preset dau întotdeauna aceleași forme.

## Contururi

O casetă, o imagine, o planșă și o cale cu Pen pot purta fiecare un contur: o culoare, o grosime și un stil (continuu, întrerupt sau punctat). Rândurile conturului stau sub **Fill** în Inspector, iar butonul **Contur** de pe bara de obiect le deschide.

**Poziție** așază conturul pe linia formei: **Interior**, **Centru** sau **Exterior**. O casetă are conturul în interior dacă nu alegi altceva, deci marginea ei exterioară rămâne unde ai desenat-o, iar o cale cu Pen are conturul centrat pe curbă. Cu un contur centrat sau exterior, umplerea, imaginea și textul rămân în marginea interioară a conturului, iar conturul de selecție rămâne pe marginea proprie a casetei. O cale deschisă nu are interior, deci conturul ei este mereu centrat. Conturul unei planșe rămâne mereu în interiorul paginii, pentru că marginea paginii este marginea exportului.

**Contur pe fiecare latură.** La un dreptunghi, o casetă rotunjită, o pilulă sau o planșă, comutatorul de lângă grosime arată patru grosimi: **Sus**, **Dreapta**, **Jos** și **Stânga**. Setează o latură la 0 ca s-o ascunzi, ceea ce îți dă un separator sau o subliniere fără o a doua formă. Comutatorul doar arată sau ascunde cele patru celule și nu schimbă niciodată o valoare. Cât timp laturile diferă, grosimea se citește **Mixt**; scrie acolo o grosime ca s-o setezi pe toate patru deodată. Culoarea, poziția și stilul rămân comune tuturor laturilor, iar colțurile rotunjite se curbează odată cu grosimile de lângă ele, ca la un border CSS. Elipsele, cercurile și căile cu Pen desenează o singură grosime peste tot.

Cum poartă formatele un contur:

| Format | Poziție | Pe fiecare latură |
|---|---|---|
| SVG, PDF, PNG și celelalte imagini | Exactă. Conturul interior sau exterior al unei căi cu Pen este desenat de două ori mai gros și tăiat pe o parte a liniei. | Un contur continuu este exact, ca o singură formă între marginea exterioară și cea interioară a conturului. Unul întrerupt sau punctat este desenat ca linii întrerupte de-a lungul fiecărei laturi în SVG și continuu în PDF. |
| Penpot | Interior, centru și exterior călătoresc ca alinierea conturului din Penpot. O planșă este mereu `inner`. | Penpot 2.19 sau mai nou citește nativ cele patru grosimi. Penpot 2.18 desenează grosimea de sus peste tot, iar Penpot 2.17 sau mai vechi refuză un fișier care poartă grosimi pe fiecare latură. |
| PowerPoint | PowerPoint desenează o linie centrată pe marginea formei. Centrul este exact; exteriorul mută forma în afară cu jumătate din grosime, ceea ce pune linia PowerPoint în afara casetei; interiorul păstrează linia centrată pe care o scriau exporturile mai vechi. | Conturul devine o formă separată (inelul dintre marginea exterioară și cea interioară), peste o formă fără linie. |
| dotLottie | Conturele Lottie sunt centrate, deci un contur exterior de casetă sau un contur interior ori exterior de cale cu Pen este refuzat cu un mesaj. | Refuzat cu un mesaj. |

Un contur centrat translucid arată pagina prin jumătatea lui interioară, nu umplerea, pe canvas și în fiecare export. Când imporți un fișier Penpot, fiecare contur își păstrează alinierea și grosimile pe fiecare latură, iar `strokeAlign` și grosimile individuale ale conturului dintr-un fișier Figma vin la fel.

## Scene 3D și instrumente în interiorul unui design

O casetă poate conține mai mult decât o imagine. Ambele feluri de mai jos păstrează o rețetă, nu o imagine randată, deci se redesenează la orice dimensiune și moment cere documentul, iar o actualizare a sursei ajunge în fiecare design care o folosește.

### Scene 3D

Alege **3D scene** din meniul de adăugare al barei și trage un cadru: 3D Studio se deschide pe noua casetă, iar ce setezi acolo revine pe canvas. Apoi, **Edit in 3D Studio** din secțiunea **3D scene** a Inspectorului redeschide studioul. [Plasează o scenă în Design](/info/3d-studio.html#place-a-scene-in-lolly-design) acoperă afișele, cronologia, exportul și partajarea.

### Instrumente în interiorul unui design

Alege **Image** din meniul de adăugare al barei, trage un cadru și alege un instrument în fila **Tools** a selectorului. Instrumentul umple cadrul cu valorile lui implicite, iar Inspectorul se deschide pe o secțiune **Tool** cu propriile controale ale instrumentului. Schimbă un câmp și caseta se actualizează după un moment, ca un singur pas undo. **Image fit** și **Image position** funcționează ca pentru orice imagine, iar **Replace with another tool or image** schimbă conținutul casetei.

**Instrumentele care se mișcă** rulează în interiorul casetei: o ilustrație în buclă continuă să se repete pe canvas, urmează capul de redare odată ce cronologia este deschisă și se exportă cadru cu cadru în GIF, MP4 sau WebM. Când instrumentul spune cât durează o buclă, caseta primește un clip exact cât durata aceea, deci un video conține bucle întregi. Un clip pe care l-ai recronometrat își păstrează timingul, iar oprirea mișcării instrumentului face caseta din nou o imagine fixă.

## Timeline (Sequence)

**Sequence** este cronologia Design: adaugă timp canvasului. Fiecare casetă poate începe la un moment, dura o anumită lungime și se poate anima la intrare și la ieșire, iar cronologia andocată sub planșă este locul unde le aranjezi. Pornește de la șablonul **Video** din Design și o scurtă secvență este deja pregătită: două carduri de text cronometrate pe rândul secvenței și un fundal muzical procedural dedesubt, ca să vezi cum funcționează cronologia înainte să schimbi ceva.

![Cronologia Sequence: transportul, rigla, o bandă de suprapunere, rândul magnetic al secvenței cu clipurile și jetoanele de îmbinare, și banda Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Există două feluri de rânduri:

- **Rândul secvenței** este magnetic. Clipurile stau cap la cap, tragerea unuia reordonează șirul, iar ștergerea unuia închide golul. Aceasta este coloana vertebrală.
- **Culoarele de suprapunere** sunt libere. Un lower-third, un logo sau o legendă plutește peste coloana vertebrală la momentul ei, fiecare pe culoarul lui.
- Sub ele, **Always on** conține casete fără timing, prezente pe tot parcursul. `+` de pe un chip mută una pe un culoar; **Make always on** o trimite înapoi.

Deschiderea cronologiei îi dă tastatura, deci Space și tastele săgeți conduc capul de redare. O compoziție care are deja timing deschide singură cronologia.

**Editare.** Trage mijlocul unui clip ca să-l muți, trage lângă oricare capăt ca să-l tai la margine și apasă **Split at playhead** (sau `S`) ca să-l tai în două. Split are nevoie de un clip cu o **Length** reală și de capul de redare puțin înăuntrul lui, deci un clip fără sfârșit, precum fundalul muzical, nu poate fi împărțit. **Snap to edges** este pornit implicit și se fixează pe marginile clipurilor, pe capul de redare și pe secunde întregi; ține Alt ca să tragi fără snapping. Fiecare tragere este un pas undo, iar previzualizarea cât tragi folosește aceeași aritmetică ca rezultatul.

Selectează un clip și inspectorul dă aceleași editări ca numere: **Length**, **Trim in** (cât de adânc în sursă începe clipul), **Speed** de la ×0.25 la ×4, **Animate in** și **Animate out** cu duratele lor și **Mute clip**. Un clip de pe rândul magnetic nu are câmp **Start**, pentru că rândul deține ordinea.

**Tranzițiile** sunt presetări: Fade, Pop, Grow, Rise, Drop, cele patru Slides, Zoom in și out, Tilt, Swoop, Spin, Drift sau **Cut (no animation)**. Distanțele se scalează cu obiectul, deci o presetare arată bine pe un card pe tot cadrul și pe o insignă mică. Între două clipuri de pe rândul secvenței, un **seam chip** alege **Cut** sau **Crossfade**; deschide-l din nou ca să setezi **Length (ms)** și apasă **Done**. Într-un crossfade, primul clip continuă să ruleze dincolo de tăietură și se estompează cât următorul apare, la fel în previzualizare și în fișier.

**Sunet.** Un clip **Audio** trăiește pe cronologie ca orice alt clip, cu formă de undă, tăiere și mute. Fundalul muzical generat al șablonului Video este sintetizat la export, deci bara lui rămâne simplă și mută până randezi. Apasă microfonul ca să **înregistrezi un voiceover** direct pe cronologie, cu numărătoare inversă și indicator de nivel; preluarea este salvată ca resursă proprie la capul de redare. Butonul camerei de lângă microfon **înregistrează un video** la fel, decupat pe planșă cât înregistrează, ca un coleg să poată adăuga un clip dintr-un link partajat. Selectează orice clip cu sunet și banda lui se deschide sub cronologie pentru volum, pan, EQ, pitch, normalizare și efecte precum **Voice cleanup**; [Sunet](/info/sequence-editor.html#sound) din ghidul editorului de secvențe acoperă banda. **Audio track** din panoul de export este separat: un singur fundal sub tot clipul, cu fade și ducking.

![Cronologia cu clipul muzical selectat: banda lui se întinde jos, cu Viteză, Fondări, Volum, Panoramare, EQ, Înălțime, Normalizează volumul și slotul Efect](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Czzfxm%25253A7%25253Alofi%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Randare.** Un export de mișcare desenează, decodează și codifică fiecare cadru la un moment exact, deci fișierul nu depinde de mașina ta să țină pasul, iar MP4 și WebM nu au un plafon practic de cadre. Lungimea cronologiei stabilește durata, dacă nu tastezi una, iar Content Credentials sunt aplicate ca la orice alt export. Un export static dă cadrul de la capul de redare sau o planșă de contact din câmpul **Frames**; vezi [Imagini statice dintr-o compoziție cronometrată](/info/exporting.html#stills-from-a-timed-composition). O secvență este plafonată la o oră. GIF și PNG animat țin fiecare cadru în memorie, deci se potrivesc clipurilor scurte. **Record live** este ascuns aici pentru că randarea cadru cu cadru este calea mai bună.

**Keyframe-uri, adâncime și o cameră.** O tranziție animează un clip la sosire și la plecare. Ca să pozezi o casetă în interiorul unui clip (derivă, estompare, blur, ridic-o de pe pagină și așeaz-o la loc), selectează clipul și apasă **+Keyframe**: romb în uneltele cronologiei, romb pe bara de obiect a canvasului sau **Shift+K** cu cronologia în focus. Poziția capului de redare decide ce poză scrie următoarea ta editare. Aceleași keyframe-uri dau unei compoziții cronometrate o cameră care se apropie, se deplasează și mută focusul. [Animare](/info/animating.html) este ghidul complet, iar [Editorul de secvențe](/info/sequence-editor.html) acoperă selecția, onion skin, împărțirea, tăierea și marcajele.

## Înainte să exporți

Design îți verifică documentul înainte să trimiți fișierul. Cardul **Before you export**, în secțiunea **Document** a Inspectorului și din nou în panoul de export, citește structura salvată a straturilor, apoi se uită la canvasul stabilizat după text tăiat și contrast pe culori plate. Întreabă același registru de fonturi pe care îl folosește conturarea SVG și PDF dacă fiecare secvență de text are octeți de font care pot fi încorporați. Textul pe care îl desenează un [font de rezervă](/info/fallback-fonts.html) în export contează ca acoperit. O scriere fără font de rezervă sau un caracter chinezesc, japonez ori coreean din afara seturilor pe care le dețin acele fonturi sunt raportate în continuare. Fundalurile cu imagine și gradient sunt listate ca verificări vizuale, nu primesc un scor de contrast inventat.

### Verifică o compoziție față de sistemul de design

Cardul panoului de export compară compoziția și cu sistemul tău de design, la aceeași versiune de sistem de design pe care o folosește randarea. Se uită la culorile create, aliasurile de tokenuri, alegerile de fonturi și id-urile de resurse imagine. O valoare personalizată poate fi intenționată, iar o imagine din afara resurselor de brand declarate este un element de revizuit, nu o imagine interzisă.

Unde există o sugestie concretă de culoare sau font, butonul ei schimbă acel singur strat, iar **Undo** restaurează originalul. Straturile blocate sau schimbate între timp nu sunt niciodată suprascrise de o sugestie veche. Gradienții, efectele, conținutul imbricat de instrument, drepturile și calitatea subiectivă sunt în afara acestei comparații, iar nicio verificare nu blochează Download.

### Reguli de casă și semnalul de scriere

Cardul panoului de export verifică și regulile de casă pe care le aduce sistemul tău de design, precum greutatea și alinierea textului, perechile de culori aprobate sau un logo pe suprafață, strat cu strat. Fiecare constatare este un avertisment cu numele stratului deasupra regulii. O regulă pentru care această versiune nu are verificator este listată ca neverificată, niciodată ca respectată. [Rules](/info/brand-studio.html#rules) listează regulile, iar `lolly check` le aplică pe aceleași unui document salvat.

Același card arată semnalul de scriere pentru textul desenat de document: banda lui (none, weak, notable sau strong), apoi propria propoziție a Verify cu scorul din 100 și până la trei fraze semnalate, fiecare cu stratul care le conține. **Open the text in Verify** duce acel text în [Lolly Verify](/#/verify) pentru citirea completă; [Dovezi AI în Verify](/info/verify-ai-evidence.html) explică ce cântărește scorul. Scorul este un semnal, nu un verdict: numără tipare comune în scrisul generat și nu poate spune cine a scris cuvintele. Straturile ascunse sunt lăsate în afara ambelor verificări, iar cardul spune câte.

Constatările de reguli de casă și un semnal puternic de scriere se numără în totalul „de reparat” al cardului, ca să fie ușor de găsit. Ele informează și nu blochează niciodată: Download rămâne disponibil și nu e nimic de respins sau de înregistrat ca excepție. Un agent care lucrează în documentul deschis primește același raport prin instrumentele lui de site ([Agenți într-un document deschis](/info/open-document-agents.html)).

Verificările de tipar (bleed, rezoluție, acoperire cu cerneală și număr de plăci) se alătură aceluiași card când activezi **Settings → Feature flags → Print preflight**. În alte instrumente acel flag este ceea ce arată cardul în sine; [Exportă un fișier](/info/exporting.html) descrie verificările de tipar.

## Prezentarea

Un document Design alcătuit din planșe este deja un deck. Apasă **Present** în bara de sus și fiecare planșă devine un diapozitiv pe tot ecranul, în ordinea în care stau planșele pe canvas. Butonul scrie **Preview** până când **Design outcome** al documentului este **Slides**. Deck-ul rulează pe o copie a planșelor randate, deci ieșirea te readuce exact unde erai.

Săgeata de lângă **Present** deschide **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** și **Export slides as video**.

| Tastă | Ce face |
|---|---|
| **Space**, `→`, **Page Down** | Pasul sau diapozitivul următor (sau fă clic pe fâșia din marginea dreaptă) |
| `←`, **Page Up** | Înapoi (sau fă clic pe fâșia din marginea stângă) |
| **Home**, **End** | Primul sau ultimul diapozitiv |
| `O` | Overview: fiecare planșă în aranjamentul canvasului tău; fă clic pe una ca s-o deschizi |
| `S` | Speaker view: diapozitivul curent, următorul, notele și un ceas într-o a doua fereastră |
| `B` | Ecran negru; orice tastă readuce diapozitivul |
| `F` | Înapoi la ecran complet |
| `K` | Pune pe pauză sau repornește un deck kiosk |
| **Escape** | Dezlipește un strat: din overview la deck, din deck la editor |

O mică bară de control apare treptat când miști cursorul și se ascunde din nou când te oprești. Dacă browserul blochează fereastra pop-up pentru speaker, speaker view se deschide ca un panou peste deck. Notele aparțin fiecărei planșe și nu apar niciodată pe diapozitiv.

Pe un ecran tactil, glisează la stânga pentru pasul sau diapozitivul următor și la dreapta ca să te întorci. O tranziție **Slide** sau **Fade** urmează degetul și se termină când îl ridici; o tranziție **Cut**, **Morph** sau **Fly between artboards** rulează integral după ce îl ridici, iar o glisare scurtă și lentă nu schimbă nimic. Casetele de pagină web, controalele video, casetele care derulează și textul selectat își păstrează propriile gesturi, deci o glisare nu începe niciodată pe una dintre ele, iar derularea verticală și zoomul prin ciupire funcționează ca de obicei. Cu mișcare redusă, diapozitivul tot se schimbă, fără să urmeze degetul.

- **Pași de dezvăluire.** Fă clic dreapta pe o casetă și alege **Reveal at step 1**, **2** sau **3** în loc de **Always visible**, iar caseta așteaptă până avansezi la pasul ei. Casetele cu același număr sosesc împreună.
- **Kiosk.** Dă unei planșe o **Length** și deck-ul stă acolo atât timp, apoi avansează în spatele unei bare subțiri de progres. Adaugă `kiosk` la link și deck-ul reia de la capăt, pentru semnalistică.
- **Stive de sub-diapozitive.** Fă clic dreapta pe o planșă și alege **Stack under the previous slide** ca să o faci un pas al acelui diapozitiv. Overview-ul arată un singur card, iar rândul **Stack** din inspector spune cărui diapozitiv îi aparține planșa.
- **Morph.** Când diapozitive consecutive conțin amândouă o casetă cu același nume **Morph match** (de exemplu `hero`), tranziția mută, redimensionează și recolorează acea casetă în loc să taie. O tranziție **Morph** la nivel de deck face la fel pentru fiecare pereche potrivită.
- **Narațiune.** **Speaker notes** ale fiecărei planșe pot fi citite cu voce tare. În secțiunea **Document** a Inspectorului alege o **Voice**, opțional o a doua voce cu care să faci **Blend with**, **Speed** și un **Lead-in** și **Tail** în milisecunde; **Show captions when presenting** arată cuvintele pe măsură ce sunt rostite. Vocea rulează pe dispozitivul tău, iar aceleași note devin coloana sonoră a unui export video, audio de diapozitiv într-un export PowerPoint și filmul narat dintr-un [pachet SCORM](/info/create/exporting.html#scorm-course-packages).

Deck-ul este și el un link. `?present` se deschide direct în el, iar `s=` alege diapozitivul (o poziție, un id de planșă sau `id.step` pentru un pas de construcție), iar adresa te urmează, deci ce trimiți este diapozitivul pe care ești. [Parametrii URL rezervați](/info/url-parameters.html#what-happens-on-open) îi documentează.

**Present with camera** plasează camera ta, un logo și o legendă cu numele peste diapozitive, cu controale private și scene salvate; vezi [Prezentare cu cameră](/info/presenting.html). O casetă **Web page** poate prelua clicker-ul în timpul unei prezentări când activezi **Make interactive** în inspectorul ei: la pasul ei **Focus on click**, Sus și Jos controlează pagina, iar Next continuă deck-ul. [Pagini live care acceptă clicker-ul](/info/interactive-pages.html) acoperă stilurile de focus, opririle de derulare și aprobarea site-ului.

## Ce urmează

- **[Text în Design](/info/text-composition.html)**: editarea textului pe canvas, curgerea articolelor prin cadre și tipografia.
- **[Animare](/info/animating.html)**: keyframe-uri, adâncime, camera scenei și straturi Lift.
- **[Importă un design](/info/design-import.html)**: deschide un fișier Figma, Penpot, Illustrator sau InDesign ca casete editabile.
- **[Partajează un design cu reguli](/info/create-a-tool.html)**: transformă un document Design într-un instrument cu doar intrările alese de tine.
- **[Exportă un fișier](/info/exporting.html)**: formate, dimensiuni, unități de tipar și video.
