# Cum folosești Lolly

Un ghid practic pentru a *folosi* efectiv aplicația - deschiderea unui instrument, lucrul pe canvas, exportul, salvarea și partajarea. Tot ce e aici rulează **pe dispozitivul tău**: fără cont, fără încărcare pe server, fără internet după prima încărcare.

> Ești nou aici? [Ghidul rapid](/info/quickstart.html) te pune pe treabă în câteva minute, iar [Lolly pentru operatori](/info/operators.html) acoperă instalarea și implementarea aplicației; pagina asta e despre cum o conduci după ce e deschisă.

## Deschiderea unui instrument

Ecranul principal e **galeria** - toate instrumentele, grupate pe categorii. Dă clic pe o cartelă ca să deschizi instrumentul; dacă ai mai lucrat cu el, un buton **Continue** reia ultima ta sesiune. Folosește caseta de căutare ca să filtrezi după nume - sau [Caută](/info/search.html) din bara aflată la baza celor șase ecrane de listare (galeria, Utilities, Projects, Catalog, Dashboard și Profile), care ajunge la lucrările tale salvate, la catalog și la setări, nu doar la instrumente. În interiorul unui instrument bara se dă la o parte pentru comenzile proprii ale instrumentului.

![Galeria de instrumente - fiecare instrument ca o cartelă, grupate pe categorii](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Fiecare instrument e o vedere împărțită în două: **comenzile** pe o parte, o **previzualizare** live (canvasul) pe cealaltă. Schimbi orice comandă și previzualizarea se actualizează instantaneu.

![Vizualizarea împărțită a unui instrument - stiva de comenzi în stânga și graficul cu bare grupate randat live pe care îl desenează în dreapta](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Câteva instrumente (cum e **Design**) se deschid în schimb ca un **canvas liber** - o suprafață fără interfață în jur, cu manipulare directă, unde tragi, redimensionezi, rotești și aliniezi casete de text, forme și imagini și dai dublu clic ca să editezi textul pe loc. Exportă pe aceeași cale de randare ca orice alt instrument, așa că pânza *este* fișierul. Vezi [Canvasul liber](#the-free-canvas-design) mai jos.

Două moduri de a modela grila însăși ca să fie cea de care ai nevoie:

- <!--i:star--> **Marchează cu stea ce folosești.** Pune ★ pe o cartelă și primește o dală mare a ei într-o bandă deasupra grilei - vezi [Favoritele tale](/info/favourites.html).
- <!--i:eyeoff--> **Ascunde un instrument pe care nu-l folosești.** Clic dreapta pe o cartelă (sau selectează mai multe și folosește bara de selecție) → **Hide tool**. Dispare din grilă și din ce găsești tastând în grilă; o dală gri **Show hidden tools (N)** de la final le scoate din nou la iveală, estompate, fiecare cu **Unhide tool** în meniul propriu. Ascunderea ține doar de grila ta - instrumentul se deschide în continuare dintr-un link salvat sau dintr-un semn de carte și rămâne exact unde era pentru toți ceilalți.

![Finalul grilei de instrumente cu instrumentele ascunse scoase la iveală: cartela estompată QR Code Generator și, lângă ea, dala gri care a readus-o în vedere, care acum scrie Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

Când preferi să întrebi în loc să cauți, **Ask Lolly** (`#/ask`) primește o întrebare scrisă și îți dă înapoi secțiunea potrivită din documentația asta **cuvânt cu cuvânt** - chiar cuvintele ghidurilor, nu un rezumat și nu o generare - cu pagina din care vine citată și un link **Open in docs** alături. Sub răspuns apar locurile din aplicație care se potrivesc cu aceeași întrebare: un instrument, o setare, un proiect salvat, fiecare ca un buton care pur și simplu te duce acolo.

Transcrierea e memorie de sesiune: pui o întrebare suplimentară și firul se adună pe măsură ce înaintezi, apoi reîncarci pagina și o ia de la capăt. Rezultatele căutării au jos un rând **Ask Lolly: *interogarea ta*** - sub orice rezultat concret găsit de celelalte grupuri - care predă întrebarea direct, așa că poți începe în bară și termina aici.

## Canvasul (previzualizarea)

Previzualizarea arată mereu exact ce se va exporta.

**Desktop**

- **Zoom:** Cmd/Ctrl-derulare sau pinch pe trackpad - zoomul se centrează pe cursorul tău.
- **Panoramare:** ține **Space** și trage sau trage cu **butonul din mijloc al mouse-ului**. (Clicurile simple rămân libere pentru a da clic pe părți din design.)
- **Tastatură:** `0` = potrivire în fereastră · `1` = 100% · `+` / `−` = zoom.
- **HUD-ul de zoom:** mica comandă `−  NN%  +  Fit` din colț. Dă clic pe procent ca să comuți Fit ↔ 100%.

![HUD-ul de zoom din colțul canvasului - minus, procentul live, plus, Fit, apoi comutatoarele de temă și de sunet](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Atingere**

- **Pinch** pentru zoom, **trage** pentru panoramare, **dublă atingere** pentru revenirea la potrivire.

**Dă clic ca să ajungi la o comandă:** dă clic pe orice element din design și câmpul corespunzător din bara laterală primește focusul și intră în vedere - la un grup de rânduri repetabile se desface exact rândul pe care ai dat clic, așa că editarea a ceea ce vezi e la o atingere distanță.

O schimbare de dimensiuni readuce mereu vederea la o potrivire curată.

### Canvasul liber (Design)

Instrumentele cu canvas liber adaugă o suprafață de lucru *în jurul* planșei de lucru, ca masa de lucru a unui designer:

- **Pregătire în afara canvasului.** Trage o casetă dincolo de marginea cadrului și rămâne complet **vizibilă și selectabilă** - parchează elemente în lateral cât aranjezi compoziția, apoi trage-le înapoi. Tot ce e în afara cadrului e **ușor estompat**, ca zona de export să se citească dintr-o privire, iar cadrul își păstrează umbra care marchează exact unde începe fișierul.
- **Se exportă doar cadrul.** Fișierul exportat e delimitat de planșa de lucru - orice rămâne în afară (sau partea unei casete care atârnă peste margine) e pur și simplu decupată din rezultat, atât în formate raster, cât și vectoriale.
- **Micșorează dincolo de Fit** (până la 20%) ca să vezi toată masa de lucru când ai pregătit lucruri departe de cadru.
- **Planșă de lucru redimensionabilă.** Schimbarea dimensiunilor de export redimensionează cadrul pe loc; casetele își păstrează pozițiile, așa că poți reîncadra o machetă în jurul conținutului existent.

![Design's free canvas - the artboard with its surrounding pasteboard](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Oglindește o selecție.** Dă clic dreapta pe orice casetă și alege **Flip horizontal** sau **Flip vertical** pentru a o oglindi pe loc, sau apasă `Shift+H` / `Shift+V` de la tastatură - Shift, pentru că un simplu `V` este unealta Pointer. Fiecare casetă selectată se oglindește pe propria axă într-un singur pas de undo, iar oglindirea este o transformare reală, deci se păstrează în SVG-ul, PDF-ul și PNG-ul exportat, nu doar pe canvas.

### Cum îți desenezi propriile forme (penița)

Casetele, cercurile și cadrele rotunjite acoperă majoritatea machetelor. Când ai nevoie de o formă care nu e în lista aceea, deseneaz-o: butonul **Pen** de pe bară (sau tasta `P`) te pune în modul de desenare. Trei taste simple te mută între moduri - **`V`** înapoi la Pointer, **`P`** pentru Pen, **`N`** pentru instrumentul de noduri (**Edit points**) - iar Pointer e mereu ieșirea din oricare mod te-ai afla.

![Bara de instrumente a canvasului liber: un mâner de tragere, meniul Lolly, apoi Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards și Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Dă clic** ca să plasezi un punct. Pe tipul de curbă implicit, **clic și tragere** scoate mânerele acelui punct, și așa desenezi o curbă în loc de un colț - ține **Alt** când dai clic ca să obții în schimb un colț ascuțit. (Pe celelalte tipuri de curbă orice punct plasat e un colț, iar tragerea nu face nimic; vezi **Spline type** mai jos.)
- Punctele se aliniază la planșa de lucru și la celelalte casete pe măsură ce le plasezi, desenând aceleași ghidaje ca o tragere obișnuită. Alt suspendă grila cât desenezi și, ulterior, atât grila, cât și marginile cât tragi un punct.
- **Dă clic pe primul punct** ca să închizi bucla și să termini dintr-o mișcare. Altfel apasă **Enter**, dă dublu clic sau doar schimbă instrumentul - desenul se păstrează, nu se aruncă.
- **Escape** lucrează treaptă cu treaptă: prima apăsare abandonează desenul și nu scrie nimic, iar a doua iese din peniță.
- **Delete** în timpul desenării șterge ultimul punct plasat.

Rezultatul e o casetă obișnuită pe canvas. Mut-o, redimensioneaz-o, rotește-o, grupeaz-o, aliniaz-o, reordoneaz-o în stivă, dă-i o umplere, un degrade, o umbră sau o opacitate - o cale se comportă ca orice altă casetă, iar niciuna dintre comenzile acelea nu o tratează diferit.

Vine și pictată. Prima cale pe care o desenezi ia umplerea și conturul pe care brandul tău le dă unei căi, iar după aceea fiecare cale nouă ia **ce ai folosit ultima dată** - setează umplerea o dată și desenează mai departe, în loc să recolorezi fiecare formă. (Într-un instrument al cărui brand nu spune nimic despre căi, o cale desenată e conturată cu culoarea în care ai văzut-o desenându-se, așa că nu e niciodată invizibilă.)

**Editarea punctelor din nou.** Dă dublu clic pe formă (sau folosește **Edit points** din bara obiectului) și punctele revin. Trage un punct ca să-l muți, trage un mâner ca să-l reorientezi, dă clic oriunde pe curbă ca să inserezi un punct, prinde un grup de puncte cu chenarul de selecție și apasă Delete ca să le ștergi pe cele selectate. O cale păstrează mereu cel puțin două puncte, așa că nu poți s-o ștergi din greșeală până la dispariție.

**Spline type** decide ce fel de curbă trece prin punctele tale și e alegerea pe care merită s-o înțelegi:

| Tip | Ce face |
|---|---|
| **Smooth (auto)** | Varianta implicită. Își calculează singură lungimile mânerelor, așa că un simplu clic-clic-clic dă o curbă cu adevărat lină, fără să te lupți cu mânerele. Dacă totuși setezi un mâner, acesta fixează *direcția*, iar curba păstrează controlul asupra lungimii. |
| **Bezier handles** | Penița clasică. Mânerele sunt punctele de control, iar inserarea unui punct nu mișcă niciodată curba. |
| **Through the points** | Trece exact prin fiecare punct plasat, fără mânere. |
| **B-spline** | Curge pe lângă puncte, nu prin ele, pentru o formă mai moale. |
| **Straight lines** | O polilinie. |

Trecerea unei căi existente la un tip care își calculează singur mânerele cere întâi confirmare, fiindcă lungimile de mâner setate de tine nu mai pot fi recuperate - trecerea la **Bezier handles** e mereu fără pierderi. În timpul desenării nu apare nicio confirmare: schimbarea se aplică direct pe schiță, iar mânerele pe care le trăseseși deja merg odată cu ea. Pe tipurile care își stăpânesc mânerele, inserarea unui punct remodelează foarte ușor curba; pe **Bezier handles** nu.

Fiecare punct poartă și o regulă de continuitate, arătată de forma lui pe canvas - pătrat pentru **Corner** (mânerele se mișcă independent), rotund pentru **Smooth** (mânerele rămân în linie), rotund cu inel pentru **Symmetric** (în linie și de lungime egală). Setează-o pentru orice puncte selectate și curba o respectă imediat.

![Două căi cu penița randate direct dintr-un link: o curbă în S conturată și o formă închisă, umplută](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

O cale desenată călătorește în link ca orice altceva, așa că o formă pe care o desenezi se redeschide dintr-un link de partajare și se randează identic din CLI. Nimic din ea nu depinde de editor.

### Combinarea formelor (operații pe căi)

Selectează două sau mai multe forme, dă **clic dreapta** pe canvas (atingere cu două degete pe ecran tactil) și meniul îți oferă operațiile pe care le aștepți de la o aplicație de desen:

- **Union** le contopește într-o singură formă, păstrând pictura celei de deasupra.
- **Subtract** decupează tot ce e deasupra din forma de la bază.
- **Intersect** păstrează doar suprapunerea.
- **Exclude** păstrează tot în afară de suprapunere.

Alte trei lucrează pe o singură formă: **Outline stroke…** transformă un contur într-o formă umplută cu același contur (util când vrei să păstrezi o grosime exact așa cum a fost desenată), **Offset path…** crește silueta spre exterior sau, cu un număr negativ, o strânge spre interior, iar **Simplify** reconstruiește o cale cu mai puține segmente la aceeași formă.

![O semilună și un inel cu o gaură reală, ambele produse cu Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Rezultatul e o cale nouă, pe care o poți edita mai departe cu penița. Găurile sunt găuri reale - o comandă **Fill rule** din panoul de contur decide dacă contururile suprapuse se umplu (*non-zero*) sau perforează (*even-odd*).

Două lucruri pe care operațiile astea nu le fac, în mod deliberat. **Refuză în loc să distrugă**: cere intersecția a două forme care nu se suprapun și ți se spune că nu e nimic de păstrat, iar nimic nu se schimbă. Iar casetele de text și de imagine nu au un contur cu care să se lucreze, așa că sunt lăsate în pace, în loc să fie aproximate prin cadrul lor. Un rezultat combinat e stocat drept curbe Bezier simple, ceea ce face și o aplicație de desen - tipul de spline original nu supraviețuiește operației.

## Timeline (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** adaugă *timp* canvasului liber. Fiecare casetă poate porni la un moment dat, poate rula o anumită durată și poate fi animată la intrare și la ieșire, iar o cronologie andocată sub planșa de lucru e locul unde le aranjezi. Deschide-l și deja rulează o secvență - un cartuș de titlu, un clip, un cartuș final, un titraj și un fundal muzical - așa că modelul e vizibil înainte să schimbi ceva.

![Cronologia Sequence Studio: transportul, rigla, o bandă de suprapunere, rândul magnetic al secvenței cu clipurile și cip-urile de îmbinare și banda Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Există două feluri de rânduri, iar diferența dintre ele e toată ideea:

- **Rândul secvenței** e *magnetic*. Clipurile stau lipite, unul după altul, iar tragerea unuia reordonează șirul în loc să lase o gaură. Șterge un clip și restul se strâng. Ăsta e șira spinării.
- **Pistele de suprapunere** sunt libere. Un titraj, un logo, o legendă - orice plutește peste șira spinării la propriul moment - primește pista lui și propriul start.
- Sub ele, **Always on** adună casetele fără nicio sincronizare: decorul care e pur și simplu prezent tot timpul. `+` de pe un jeton îl promovează pe o pistă; **Make always on** îl trimite înapoi.

![Scena de editare: planșa de desen în prim-plan și centru, șina de unelte în stânga și HUD-ul de zoom în colț](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Deschiderea cronologiei îi dă tastatura, așa că Space și tastele săgeți conduc capul de citire, nu pagina - și, fiindcă se deschide singură pe o compoziție care are deja sincronizare, asta e valabil din clipa în care se încarcă Sequence Studio.

> **[Editorul de secvențe](/info/sequence-editor.html)** intră mai adânc în cele patru lucruri care decid dacă editarea în timp e previzibilă: ce clip editează un clic pe canvas, siluetele în transparență ale clipurilor vecine, domeniul tăierii și Join-ul care anulează o tăiere și tunderea (inclusiv setul de taste). Apasă `?` cu cronologia focalizată pentru fișa de scurtături.

**Editarea.** Trage de mijlocul unui clip ca să-l muți sau să-l reordonezi, trage la câțiva pixeli de oricare capăt ca să-l tunzi și apasă **Split at playhead** (sau `S`) ca să tai un clip în două. Split are nevoie de un clip cu o **Length** reală și de capul de citire puțin înăuntrul lui, așa că un clip fără sfârșit (fundalul muzical, de exemplu) nu poate fi tăiat. **Snap to edges** e activ implicit și se aliniază la marginile clipurilor, la capul de citire și la secundele întregi, cu Alt pentru anulare. Fiecare tragere e un singur pas de anulare, iar previzualizarea tragerii face aceleași calcule ca aplicarea, așa că ce vezi în timp ce tragi e ce obții.

Selectează un clip și inspectorul îți dă aceleași modificări sub formă de numere: **Length**, **Trim in** (cât de departe în sursă începe), **Speed** ca set de multiplicatori ficși de la ×0,25 la ×4, **Animate in** / **Animate out** cu duratele lor și **Mute clip**. Un clip de pe rândul magnetic nu are câmp **Start**, intenționat - rândul stăpânește ordinea, așa că îl muți prin tragere.

**Transitions** sunt presetări, nu cadre-cheie: Fade, Pop, Grow, Rise, Drop, cele patru Slides, Zoom in și out, Tilt, Swoop, Spin, Drift sau **Cut (no animation)**. Distanțele se scalează cu obiectul, așa că aceeași presetare se citește corect și pe un cartuș pe tot ecranul, și pe o insignă mică. Între două clipuri alăturate de pe rândul secvenței apare un **jeton de îmbinare**: dă clic pe el și alege **Cut** sau **Crossfade**, care se aplică pe loc și se închide. Deschide același jeton din nou ca să schimbi **Length (ms)** și apasă **Done**. Un crossfade e stocat ca o estompare a unuia și o apariție a următorului, iar exportul derivă dizolvarea propriu-zisă din perechea aceea - de asta un crossfade arată ca două estompări în previzualizare și ca o predare adevărată în fișier.

**Sunetul.** Adaugă un clip **Audio** și stă pe cronologie ca orice alt clip: formă de undă, tundere, mut. (Fundalul generat cu care vine sesiunea implicită e singura excepție - e sintetizat la export, așa că bara lui rămâne simplă și tăcută până randezi.) Apasă microfonul ca să **înregistrezi o voce** direct pe cronologie, cu numărătoare inversă și indicator de nivel, iar înregistrarea se salvează ca resursă proprie în punctul din care ai pornit. Apasă camera de lângă el ca să **înregistrezi un videoclip** în același fel: înregistrarea e decupată la dimensiunea de export a planșei de lucru pe măsură ce înregistrezi, așa că mica auto-vizualizare arată exact ce ajunge în secvență la capul de citire, în cadru complet - modul de a aduna clipul unui coleg dintr-un link partajat. Muzica, dialogul și coloana sonoră proprie a unui clip ajung toate în mixajul exportat. (**Audio track** din panoul de export e altceva: un singur fundal așezat sub tot clipul, cu estompare și atenuare. Cele două coexistă.)

**Randarea.** Un export cu mișcare e o **compoziție deterministă**, nu o înregistrare de ecran - fiecare cadru e decodat, desenat și codat la un moment exact, așa că fișierul nu depinde de cât de bine ține pasul mașina ta, iar la MP4 sau WebM nu există o limită practică de cadre. Durata e dată de lungimea cronologiei, dacă nu scrii tu una. Content Credentials sunt aplicate ca la orice alt export. Un export static îți dă cadrul de la capul de citire sau o planșă întreagă de contact din câmpul **Frames** de lângă dimensiunea de ieșire - vezi [Export](/info/exporting.html#stills-from-a-timed-composition).

Câteva limite de reținut: o secvență e plafonată la o oră, GIF și PNG animat își stochează cadrele în memorie, deci rămân scurte, sunetul e mut pe un clip a cărui viteză nu e ×1 (încă nu există întindere în timp), iar **Record live** e ascuns aici fiindcă compozitorul e calea mai bună.

**Dincolo de presetări: chei de animație, adâncime și o cameră.** O tranziție animă un clip pe măsură ce apare și dispare. Pentru a poziționa un element *în interiorul* unui clip - să-l deplasezi, să-l estompezi, să-l încețoșezi, să-l ridici de pe pagină și să-l așezi la loc - adaugă chei de animație: selectează clipul, apasă **+Keyframe** (romboul din clusterul de instrumente al cronologiei, romboul din bara obiectului de pe pânză sau `K`), iar poziția cursorului de redare decide ce poziție scrie următoarea ta modificare. Același sistem de chei de animație dă fiecărei compoziții temporizate o **cameră** care avansează, panoramează și schimbă focalizarea, transformând un SVG plat într-o stivă de straturi între care poți zbura. **[Animație](/info/animating.html)** este ghidul complet.

Instrumentul Design are aceeași cronologie, așa că poți sincroniza o machetă fără să treci la alt instrument, și exportă și mișcare.

## Prezentarea

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Un document Design făcut din **planșe de lucru** e deja o prezentare. Deschide **meniul Lolly** de pe bara de instrumente și alege **Present** - ultimul rând - și fiecare planșă de lucru devine un diapozitiv pe tot ecranul, în ordinea în care planșele stau pe canvas. Prezentarea rulează pe o copie a planșelor randate, așa că editorul de dedesubt nu e atins niciodată, iar la ieșire te întorci exact unde erai.

- **Avansează** cu **Space**, `→`, **Page Down** sau un click pe banda de la marginea dreaptă a ecranului; mergi înapoi cu `←`, **Page Up** sau banda de la marginea stângă. **Home** și **End** sar la primul și la ultimul slide. O bară mică de comenzi apare treptat de fiecare dată când miști cursorul și se ascunde din nou când te oprești.
- **Overview** (`O` sau butonul de grilă) așază toate artboardurile deodată, în aranjamentul pe care li l-ai dat pe canvas; dă click pe unul pentru a-l deschide.
- **Pași de dezvăluire.** Dă click dreapta pe o casetă și alege **Reveal at step 1**, **2** sau **3** în loc de valoarea implicită **Always visible**. Acea casetă așteaptă apoi până avansezi la pasul ei, astfel încât un slide poate apărea în etape; casetele care au același număr apar împreună.
- **Speaker view** (`S`) deschide o a doua fereastră cu slide-ul curent, cel care urmează, notițele tale pentru acel slide și un cronometru care rulează. Dacă browserul blochează fereastra pop-up, se trece pe un panou peste deck. Notițele se stabilesc per artboard și nu apar niciodată pe slide-ul propriu-zis.
- `B` ține ecranul negru (orice tastă aduce slide-ul înapoi), `F` revine la fullscreen, iar **Escape** desprinde câte un strat pe rând: din overview înapoi în deck, din deck înapoi în editor.
- **Kiosk.** Setează o **Length** pentru un artboard, iar deck-ul rămâne acolo atâta timp, apoi avansează singur, în spatele unei bare subțiri de progres; `K` (sau butonul de pauză, care apare doar odată ce ceva are o lungime) oprește și repornește asta. Adaugă `kiosk` la link, iar deck-ul reia de la început când ajunge la final, ceea ce îl face potrivit pentru semnalistică (signage).

Prezentarea e și un link. `?present` deschide direct în ea, `s=` numește diapozitivul - o poziție, un id de planșă de lucru sau `id.step` pentru un pas de construcție - iar adresa se actualizează pe măsură ce înaintezi, așa că ce trimiți e diapozitivul la care ești. Autori de instrumente: parametrii aceia sunt documentați pe pagina [URL Mode](/info/url-mode.html#reserved-parameters).

## Pe telefon

Pe ecrane înguste macheta se rearanjează pe o singură coloană:

- **Comenzile devin o foaie** în partea de sus, cu un **mâner de tragere** pe marginea de jos. Trage de mâner ca s-o redimensionezi - se fixează la **peek / half / full** - sau **atinge** mânerul ca să comuți între restrâns ↔ extins. Previzualizarea umple spațiul de dedesubt și rămâne vizibilă cât timp editezi.
- Un buton **Export** plutitor deschide foaia de export - toate comenzile de format, dimensiune, copiere, salvare și descărcare într-un singur loc. O închizi atingând fundalul.

![Un instrument pe un ecran de lățimea unui telefon - comenzile ca foaie sus, paleta generată umplând previzualizarea de dedesubt și pastila de randare plutind jos, în centru](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Comenzile (câmpurile)

Instrumentele expun doar câmpurile care sunt menite să varieze - tot restul (culori, machetă, tipografie, logică) e fixat de autorul instrumentului, așa că orice faci respectă regulile stabilite de autor. Câmpurile includ text, glisoare, selectoare de culoare, liste derulante, date, selectoare de imagini și grupuri de rânduri repetabile. Unele sunt grupate în secțiuni pliabile.

![Stiva de comenzi a unui instrument - un câmp de text, declanșatoare de culoare și un glisor, și nimic altceva din ce a ales autorul să fixeze](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Resetare:** *Clear changes* readuce fiecare câmp la valorile lui implicite.

### Anulare și refacere

**Cmd/Ctrl-Z** face un pas înapoi, iar **Cmd/Ctrl-Shift-Z** (sau **Cmd/Ctrl-Y**) unul înainte. Aceeași pereche stă ca butoane **Undo** și **Redo** pe rândul de deasupra comenzilor - pe canvasul liber sunt pe bara de instrumente - și fiecare se estompează cât timp nu mai e nimic de luat înapoi. Fiecare pas spune ce a fost: anulezi o culoare și un mesaj scurt numește câmpul pe care tocmai l-a restaurat, cu un buton **Redo** în el pentru drumul înapoi.

- **O tragere e un singur pas.** Modificările repetate ale aceleiași comenzi într-o jumătate de secundă se contopesc, așa că plimbarea unui glisor pe toată cursa lui e o singură anulare, nu două sute.
- **Se păstrează ultimii 100 de pași** - cei mai vechi cad de la coadă. O modificare nouă după o anulare golește stiva de refacere, ca peste tot altundeva.
- **Cât timp cursorul tău e într-o casetă de text**, Cmd/Ctrl-Z aparține câmpului însuși, caracter cu caracter. Lolly preia comanda pentru controalele care nu au o anulare proprie utilă: glisoare, liste derulante, culori și comutatoare.
- **Alegerea unui fișier** într-un câmp **file** nu e un pas - octeții aceia sunt ținuți doar pe durata sesiunii, așa că nu ar fi nimic de pus la loc.

Într-o [colaborare](/info/collaborate.html) live, istoricul rămâne doar al tău. O modificare venită de pe celălalt dispozitiv nu ajunge niciodată pe stiva ta, astfel încât anularea poate readuce doar ceva ce ai făcut tu.

## Datele tale & fotografia de profil

**Profile** (dreapta sus în galerie) ține numele tău, datele de contact și o **fotografie de profil** opțională. Instrumentele care cer câmpurile astea le completează automat - setează-le o dată și semnătura de e-mail, lockup-urile și insignele se completează singure. Poți suprascrie oricând orice câmp, pe durata unei sesiuni. Activează **Use my details to create** ca datele tale să te însoțească drept autor în ce exporți.

Fotografia și datele tale stau **doar pe dispozitivul ăsta**. Un profil poate fi mai mult decât tine - o echipă sau un rol în care intri din când în când. Vezi **[Profiluri](/info/profile.html)** pentru imaginea completă, inclusiv cum ții mai multe.

## Salvare & continuare

Dă clic pe **Save** ca să stochezi valorile curente ca sesiune pentru instrumentul acela. Poți ține mai multe sesiuni cu nume pentru fiecare instrument; butonul **Continue** al fiecărui instrument o redeschide pe cea mai recentă, iar **butonul de istoric** (dreapta sus, lângă profilul tău) listează toate sesiunile salvate din toate instrumentele. Sesiunile sunt locale, pe dispozitiv. Ca să le organizezi, deschide **Projects** (mai jos).

![Pastila de randare în două jumătăți - o săgeată în sus care deschide panoul de export și o bifă care salvează sesiunea pe loc](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projects

**Projects** - îl deschizi din fila **Projects** de lângă **Tools** sau din **Profile → Storage → Organise in Projects** - e o casă pentru tot ce ai salvat și funcționează ca un manager de fișiere:

![Projects - sesiuni salvate organizate în foldere care se pot cuibări](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Foldere care se cuibăresc.** Grupează sesiunile salvate în foldere și foldere în foldere, oricât de adânc vrei. Creează un folder, redenumește-l sau trage o dală peste alt folder ca s-o muți; o urmă de pesmet te duce înapoi în sus. Un folder **Uncategorised** mereu prezent ține tot ce nu e încă clasat.
- <!--i:clock--> **Sortează cum vrei tu.** **View & sort** oferă **Name**, **Date added**, **Last modified** (varianta implicită) și, în interiorul unui folder, **By tool**. Folderele vin mereu primele, indiferent de sortarea activă - sortarea ordonează doar sesiunile și folderele în interiorul propriului grup.
- <!--i:document--> **Clasează lucrări noi direct.** **New asset** ("Start a fresh creation" la rădăcină, "Add to *folder*" într-un folder) deschide un instrument și clasează automat prima lui salvare în folderul acela.
- <!--i:checklist--> **Selecție multiplă (desktop).** Bifează caseta unei dale, trage un dreptunghi de selecție peste spațiul gol sau folosește **Shift/Cmd-clic**; **clic dreapta** pe o dală pentru meniul ei contextual. Apoi acționezi asupra întregii selecții deodată - același gest și aceeași bară de acțiuni plutitoare funcționează în galeria Tools, în Utilities, în Catalog și în Projects, nu doar aici.
- <!--i:download--> **Randează un folder întreg sau o selecție.** **Render folder** exportă fiecare sesiune salvată dintr-un folder - inclusiv subfolderele lui - ca un singur `.zip` cuibărit. **Render selection** face același lucru pentru orice selecție multiplă, iar o singură sesiune se randează direct în propriul fișier. Fără Batch/Pro.
- <!--i:link--> **Sari direct la lucrările salvate ale unui instrument.** Bifează unul sau mai multe instrumente în galeria Tools și alege **View sessions** din bara de selecție - Projects se deschide arătând doar sesiunile făcute cu instrumentele acelea, cu un **Clear** ca să revii la vederea completă.
- <!--i:link--> **Partajează o sesiune salvată.** Clic dreapta pe o sesiune → **Share link** ca să copiezi un link care o redeschide cu exact aceleași valori (dialogul Share complet - vezi mai jos).

![Popoverul View and sort din Projects deschis, cu un rând de temă, o alegere View între Preview sau List și Name, Date added și Last modified sub Sort](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**Ce oferă bara de selecție** diferă puțin de la o vedere la alta, fiindcă nu orice acțiune are sens peste tot:

- **Tools / Utilities:** Favourite (sau Unfavourite), Hide (sau Unhide), Available offline (sau Remove from offline), **View sessions** (saltul descris mai sus) și Copy link când e selectată exact o cartelă.
- **Catalog:** Favourite și Hide se aplică oricărei selecții; Duplicate, Download și Delete apar doar după ce fiecare element selectat e o încărcare de-a ta - o resursă partajată din sistemul de design e un contract permanent, așa că cele trei rămân inactive pentru ea chiar și în bloc.
- **Projects:** **Render selection**, **Move to…**, **New folder**, **Delete**, **Edit together** când selecția are între două și opt sesiuni ale aceluiași instrument (le deschide una lângă alta sub o singură bară laterală combinată) și **Edit as sheet**, care deschide în schimb toată selecția ca rânduri în grila de loturi. Acela nu are **nicio limită de mărime** și nu-i pasă dacă sesiunile vin de la același instrument, așa că e ieșirea de siguranță atunci când o selecție e mai mare sau mai amestecată decât cele două-opt ale lui Edit together.

> O capcană de etichetă: **View sessions** există doar după ce ceva e *selectat*. Clic dreapta pe o singură cartelă neselectată oferă în schimb **N saved sessions**, care deschide dialogul de istoric al instrumentului aceluia, în loc să te ducă la Projects.

![Două carduri de instrumente bifate în galeria Tools, cu bara plutitoare de selecție afișând 2 selected și oferind Available offline, View sessions, Favourite și Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
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
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Cum îți partajezi lucrarea

Un design pleacă în două feluri: ca link sau ca fișier. Dialogul Share le oferă pe amândouă. Îl deschizi cu **Share** din comenzile de export; **Share link** pe o sesiune salvată din Projects deschide același dialog pentru sesiunea aceea.

### Linkul

Fiecare câmp e cuprins în URL-ul paginii, așa că un link *este* designul. În capul dialogului stă linkul gata de copiat, cu două secțiuni restrânse sub el.

- **Link options** conține **Shortest link** (un design mare face un URL lung, așa că asta împachetează toată starea într-un jeton compact și îți arată economia în caractere; forma lizibilă rămâne mereu disponibilă), **Password-protect this link** (AES-256 peste tot linkul, iar parola nu e niciodată în el) și **Pin this tool version** - indicatorul `_v`, care fixează linkul la versiunea de instrument pe care o vezi, ca o actualizare ulterioară să nu poată schimba ce randează.
- **Link behaviour** e ce se întâmplă când destinatarul îl deschide: ecran complet, panoul de export deja extins, descărcare la deschidere cu `&export` sau copiere în clipboard cu `&copy`.

Trimite linkul unui coleg, pune-l la favorite sau comite-l în cod. (Detalii complete: [URL Mode](/info/url-mode.html).)

**Unele instrumente fac din link întregul produs.** Jump Page adună linkurile tale pe o singură pagină de distribuit - un link bio, o prezentare de conferință, o vitrină de magazin. Nu este nimic de găzduit și niciun cont în spate: pagina este linkul, așa că se deschide la fel de repede pe cât călătorește adresa URL. În editor vezi pagina finalizată lângă câmpuri; un vizitator care deschide linkul o primește pe toată lățimea, un link per scenă pe măsură ce derulează.

![Jump Page în editor - titlul, trei scene de linkuri, fiecare cu propriul fundal colorat, și un subsol Made with Lolly, aranjate ca o singură pagină pe pânză](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Dialogul spune ce nu poate duce un link.** Trei lucruri nu încap într-un URL: o imagine sau un fișier adăugat de pe dispozitivul ăsta, o valoare de text foarte lungă sau o listă foarte mare. Fiecare e numărat pe măsură ce se construiește linkul. Dacă a trebuit să se renunțe la ceva, dialogul îl numește și te trimite la fișierul de mai jos, în loc să-ți dea un link care se deschide fără poză. Un link doar *lung* primește o notă mai blândă, cu numărul de caractere, fiindcă împachetarea încă poate salva situația.

### Fișierul .lolly

**Download .lolly**, din dialogul Share al instrumentului în care lucrezi, scrie același design ca fișier. Duce sesiunea salvată împreună cu imaginile și fișierele adăugate de pe dispozitivul tău. Grafica din catalog pe care se bazează designul călătorește și ea înăuntru, așa că fișierul se deschide complet pe o mașină care nu ți-a văzut niciodată brandul. Acolo unde dispozitivul tău are o foaie de partajare, **Send to…** îi predă fișierul direct (AirDrop, o partajare pe Android), în loc să-l salveze pe disc.

Un `.lolly` e un zip obișnuit. Redenumește-l `.zip` și deschide-l: imaginile tale sunt în `assets/uploads/`, iar grafica din catalog în `assets/catalog/`, fiecare cu numele și extensia reale, `manifest.json` le listează pe toate, iar un README de la început spune ce e fișierul.

Trei lucruri sunt ale tale de decis înainte să plece:

- **Dacă numele tău apare sau nu.** Numele, e-mailul și organizația ta sunt scrise în fișier doar când **Use my details to create** e activat în profilul tău. Cu opțiunea dezactivată, fișierul înregistrează că a fost creat cu Lolly și când - nimic despre tine.
- **Dacă arta licențiată intră sau nu.** Activele licențiate și cele blocate de brand sunt reținute implicit. Dacă designul folosește vreunul, dialogul spune câte sunt și oferă două butoane - *Download without them* sau *Include and download* - pentru că includerea lor înmânează fișierele reale oricui deschide `.lolly`-ul.
- **Dacă unealta intră sau nu.** **Include the tool** ambalează fișierele proprii ale uneltei alături de design, ca acesta să se deschidă pe un dispozitiv care nu are unealta respectivă. Vine bifat pentru o unealtă personalizată - o ramificație (fork) sau o unealtă de brand privată pe care destinatarul e puțin probabil să o aibă - și nebifat pentru o unealtă listată în catalogul semnat, deoarece copia lor provine din aceeași sursă. (Pe o versiune fără catalog semnat, orice unealtă contează drept personalizată și caseta pornește bifată.)

**Deschiderea unui fișier.** Trage un fișier `.lolly` peste aplicație: resursele ajung în biblioteca ta, sesiunea ajunge în Projects, iar instrumentul se deschide pe ea. Nimic al tău nu este suprascris: sesiunea apare ca un nou slot salvat, în timp ce o resursă deja existentă pe acest dispozitiv este potrivită după suma de control și reutilizată în loc să fie duplicată. Fiecare parte este verificată față de propriile sume de control ale fișierului la import, astfel încât o copie deteriorată în tranzit este refuzată în loc să fie importată pe jumătate.

Dacă fișierul aduce un instrument pe care nu-l ai, Lolly întreabă înainte ca instrumentul acela să poată rula: **Trust this tool?** îl numește pe el și pe autorul lui și spune limpede că deschiderea rulează codul propriu al instrumentului pe dispozitivul tău, cu **Trust & install** ca trecere mai departe. Refuză și lucrarea partajată tot se salvează în proiectele tale, așteptând acolo ziua în care adaugi instrumentul. (Un fel de instrument nu poate fi încărcat lateral încă - unul al cărui cod vine ca modul - și e refuzat în același fel.)

Și un link, și un fișier predau un instantaneu. Ca să lucrezi la aceeași sesiune *în același timp* cu altcineva - două dispozitive, fără server, fără internet dacă sunteți în aceeași rețea - vezi [Cum lucrați împreună](/info/collaborate.html).

## Camera live (instrumente care reacționează la mișcare)

Fiecare **Filter** de fotografie - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch și Imperfections - arată un buton **Go live** acolo unde există o cameră. Pornește-l și efectul urmărește camera ta web cadru cu cadru, deci reacționează la mișcare; poți înregistra rezultatul în GIF, WebM sau MP4. Cadrele sunt citite și prelucrate **pe dispozitivul tău** și nu îl părăsesc niciodată, iar camera e eliberată în clipa în care oprești sau ieși din instrument. (Orice selector de imagini are și **Take a photo**, ca să prinzi un singur cadru ca imagine locală.)

## Imaginile mele

Când un instrument te lasă să adaugi o imagine de pe dispozitiv, ea e păstrată exact așa cum a sosit - deci un Content Credential de pe ea încă se verifică - și salvată în biblioteca ta personală **My images** (sub **Profile → Storage**). Doar un fișier cu adevărat uriaș te întreabă dacă să-l păstreze sau să-l redimensioneze. Refolosește-o în orice instrument. Ca să cureți EXIF/GPS pe măsură ce intră imaginile, activează **Strip metadata from uploads** în profilul tău. Nu există plafon: biblioteca e complet locală și limitată doar de spațiul dispozitivului tău - de acolo gestionezi sau ștergi imaginile.

## Catalogul - biblioteca ta de resurse

**Catalog** (`#/c` sau segmentul **Catalog** din comutatorul Projects · Tools · Utilities · Catalog din capul fiecărei vederi de listare) adună tot ce pot folosi instrumentele tale - logouri de brand, imagini, audio și mișcare, grupate pe feluri - și e și locul unde stau **fișierele tale creative**. Fără server, fără consolă de administrare, fără pull request: totul e pe dispozitivul tău.

![Catalogul - resurse de brand, mostre și fonturi, plus propriile tale încărcări](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Adu-ți fișierele.** Trage orice imagine, SVG, clip audio, video, Lottie, PDF sau prezentare PowerPoint pe zona de încărcare - sau dă clic pentru a alege - și apare instantaneu în catalogul tău, gata în selectorul de resurse al fiecărui instrument. Un PDF cu mai multe pagini sau un fișier `.pptx` întreabă ce pagini sau diapozitive să păstreze - fiecare devine o resursă SVG. Încarcă oricât de mult vrei; nu părăsește niciodată dispozitivul tău.
- <!--i:star--> **Marchează ca favorit ce folosești des.** Marchează cu ★ o resursă (sau o mostră de brand) și se fixează în partea de sus a fiecărui selector, astfel încât logo-ul sau culoarea ta preferată sunt la un clic distanță.
- <!--i:folder--> **Fă ordine.** Recategorizează o resursă într-un alt grup, ascunde o resursă de brand partajată pe care n-o folosești (cu **Show hidden** pentru a o aduce înapoi) sau șterge definitiv propriile fișiere încărcate. Același gest de selecție multiplă și aceeași bară de acțiuni plutitoare ca în Projects funcționează și aici, astfel încât oricare dintre acestea poate fi făcută pentru o întreagă selecție deodată.
- <!--i:layers--> **Elimină fundalul dintr-un video.** Deschide detaliile unui video sau dă clic dreapta pe cardul lui în orice selector de resurse și alege **Remove background…** pentru a salva o alternativă transparentă - un WebP sau PNG animat cu alfa reală. Alege o **Method**: un **On-device model** decupează un subiect dintr-o scenă aglomerată, sau o **Colour key** elimină un fundal uniform luminat și plat, cum ar fi un green screen sau un perete simplu, cu **Tolerance**, **Softness** și **Spill removal** pentru a regla marginea. Cheia de culoare nu necesită nicio descărcare de model și nicio rețea, așa că **Remove background** este oferit la orice video și este adesea mai curat pe imagini îngrijite. Un control **Resolution** (360, 480, 720 sau 1080p, niciodată peste sursă) schimbă detaliul pentru un fișier mai mic și mai rapid. Rulează ca sarcină în fundal pe dispozitivul tău. Decuparea finalizată este salvată lângă original ca resursă proprie, iar Content Credential-ul videoclipului sursă călătorește alături ca ingredient. (Vezi [Generat o dată, randat la fel](/info/ai-features.html) pentru de ce eliminarea fundalului rămâne o editare simplă.)

### Ia-ți paleta și fonturile oriunde

Panoul **Swatches** din Catalog face mai mult decât să afișeze - dă clic pe o culoare ca s-o copiezi sau **descarcă toată paleta de brand** în formatul pe care îl vorbește celălalt instrument al tău:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** sau **CSS classes** - pui brandul direct într-o foaie de stil sau într-un build;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - îl încarci în Illustrator sau Photoshop;
- <!--i:pentool--> **GIMP palette (.gpl)** - pentru GIMP sau Inkscape.

![Panoul Swatches - cele cinci butoane de descărcare a paletei de-a lungul părții de sus, apoi fiecare culoare de brand ca jeton copiabil](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Panoul **Fonts** îți listează fonturile de brand cu câte o **descărcare** lângă fiecare, ca să le instalezi local sau să le dai unei tipografii. (Camera Colours din [Brand Studio](/info/brand-studio.html) oferă aceeași descărcare a paletei.)

Resursele sunt o jumătate a căii deschise, în care faci singur lucrurile; cealaltă e **să-ți construiești propriile instrumente** - canvasul liber (Design, descris mai sus) te lasă să construiești unul vizual, fără cod.

## Sunet & accesibilitate

Lolly își propune să fie comod de folosit pentru toată lumea. Interfața se poate parcurge de la tastatură, comenzile personalizate poartă etichete corecte pentru cititoarele de ecran, iar previzualizarea live a fiecărui instrument e expusă ca o singură imagine etichetată care descrie ce se face.

Un strat blând de **sunete de asistență** confirmă ce faci - sosirea în galerie, o verificare Content Credentials validă față de una nevalidă, închiderea unui panou, schimbarea unui filtru. E **dezactivat implicit**: activează **Sound** oriunde apare comutatorul (popoverul de opțiuni al fiecărei vederi sau **Profile**), iar alegerea se reține.

Patru setări de confort, activate de tine, stau sub **Profile → Accessibility**: **Reduce motion** (renunță la tranzițiile și înfloriturile aplicației), **Hide colourful previews** (cartele de galerie liniștite, doar cu pictogramă și text, și miniaturi de proiect mai domoale), **High contrast** (borduri, text și inele de focus mai puternice) și **Large text** (literă mai mare în aplicație - etichete, meniuri, text de buton). Toate patru liniștesc aplicația *din jurul* lucrării tale: nu ajung niciodată în canvasul unui instrument și nu schimbă niciun pixel din ce exporți, iar fiecare e oprită până o pornești tu. Detalii complete în [Profilul tău → Accesibilitate](/info/profile.html#accessibility).

Lângă comutatorul Sound stă **Neurospicy Mode** - o pistă de fundal opțională și calmantă, pentru concentrare, care se aude încet cât timp lucrezi. Când o pornești se deschide un mic **doc de player** în colțul de jos, care te urmează prin aplicație; de acolo poți căuta și alege o piesă, poți sări înainte și înapoi, poți regla volumul și îl poți minimiza sau închide. Lista de piese acoperă câteva categorii - melodii procedurale *Lolly Sings*, bucle ambientale și ritmuri, audio încărcat de tine și câteva posturi de **radio** live de pe internet (astea au nevoie de conexiune; tot restul se aude offline). E **dezactivat implicit** și, la fel ca Sound, se reține de la o sesiune la alta și de la un dispozitiv la altul. Dacă oprești Sound, se oprește și pista de concentrare.

## Stocare & confidențialitate

Totul e stocat în baza de date locală a browserului tău (IndexedDB): profilul, sesiunile salvate, imaginile încărcate și o memorie cache a conținutului de catalog descărcat. **Profile → Storage** arată consumul și îți permite:

- <!--i:box--> **Clear cache** - renunță la conținutul de catalog descărcat (se resincronizează la următoarea încărcare).
- <!--i:trash--> **Clear all my data** - șterge profilul, sesiunile și imaginile. *Nu se poate anula.*

![Cardul de stocare pe un ecran de lățimea unui telefon: fiecare categorie de date de pe dispozitiv, numită, cu butonul Clear all my data jos](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Niciuna dintre datele astea locale nu e transmisă nicăieri - fără telemetrie, fără randare în cloud. Lista completă a tot ce descarcă sau trimite vreodată aplicația e în [Politica de confidențialitate](/info/privacy.html), iar [Suprafața de server](/info/server-surface.html) inventariază componentele opționale de server.

## Mutarea pe alt dispozitiv

Fiindcă totul stă pe dispozitivul tău, **Profile → Storage → Move to another device** îți permite să duci tot pe o a doua instalare - fără cont, fără cloud:

- <!--i:download--> **Export my data** descarcă un singur `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (părțile numelui vin din profilul tău și sunt lăsate deoparte dacă nu sunt completate; `<n>` e un contor zilnic, ca exporturile din aceeași zi să nu se ciocnească) care conține profilul tău, fiecare sesiune salvată (cu miniatura ei), imaginile încărcate și preferințele tale (tema, lățimea barei laterale, statistici locale de activitate).
- <!--i:upload--> **Import data…** pe cealaltă instalare citește fișierul acela înapoi. **Îmbină**: orice are același nume (profilul tău, un slot de sesiune, o imagine) e înlocuit de copia importată; tot restul de pe dispozitivul acela se păstrează. Sesiunile salvate se releagă automat la imaginile tale importate.

Memoria cache a catalogului nu e inclusă - se redescarcă singură pe dispozitivul nou. Pachetul e un zip simplu (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, id de format `lolly-backup`), așa că trece intact prin e-mail, USB sau AirDrop și e același format pe care îl citește fiecare shell. Fiecare parte are sumă de control, așa că un fișier deteriorat pe drum e prins la import, nu restaurat pe jumătate. (Specificația completă a formatului: [Transferul de date](/info/data-transfer.html).)

## Importarea unui design (Figma, Penpot, Illustrator, InDesign)

Poți aduce un design existent în Lolly și poți lucra mai departe la el: deschide **Design**, dă clic pe **Import a design** în bara de instrumente a canvasului și alege un **.fig** de Figma sau un SVG, un **.penpot** de Penpot, un **.ai** / **.pdf** de Illustrator sau un **.idml** de InDesign. Straturile devin casete editabile pe canvasul liber - textul rămâne rescriabil, imaginile ajung în **My images**, iar literele și culorile se conformează valorilor globale ale brandului - apoi rezultatul se salvează, se partajează și se randează ca orice altă sesiune. Analiza se face în întregime pe dispozitivul tău. Detalii complete: **[Importarea unui design](/info/design-import.html)**.

## Exportul

Vezi **[Export & formate](/info/exporting.html)** pentru povestea completă - alegerea unui format, dimensiunea de ieșire și unitățile de tipar, transparența, videoul și copierea/partajarea. Pe scurt: alegi un format, setezi dimensiunea dacă ai nevoie și dai **Download** (sau **Copy** în clipboard).

## Modul Batch (Pro)

Pentru utilizatorii avansați, **Batch** (accesibil din galerie, în spatele indicatorului de funcționalitate Pro, care e activ implicit) randează multe variante deodată - o grilă în care fiecare rând e un set de valori, exportate împreună. Ideal pentru localizarea unui card în douăsprezece limbi sau pentru generarea tuturor variantelor de dimensiune dintr-o singură trecere. Umple rândurile tastând, lipind direct dintr-o foaie de calcul sau importând un CSV (poți și exporta unul înapoi) și setează formatul, dimensiunea și numele fișierului de ieșire pentru fiecare rând. Salvează o grilă întreagă ca **sesiune de lot** cu nume, care se redeschide din galerie, și descarcă toate rândurile ca un singur `.zip`.

![Bara de instrumente a modului Batch - numele arhivei zip, unități, DPI și formatul moștenit de fiecare rând, cu Sessions și Render în dreapta](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch e pentru generarea **multor variante ale unui singur șablon** deodată. Ca să randezi din nou sesiuni pe care le-ai **salvat deja**, folosește **Projects → Render folder / Render selection** (mai sus) - fără Pro.

## Editarea una lângă alta (Multi-edit)

Batch înseamnă multe variante ale *unui singur* design. **Multi-edit** este cealaltă jumătate a sarcinii: mai multe designuri salvate **diferite**, deschise deodată, astfel încât o singură modificare se aplică tuturor. Bifează între **două și opt** sesiuni salvate în **Projects** și alege **Edit together** din bara de selecție; se deschid ca și carduri live unul lângă altul la `#/multi?s=<slot>,<slot>…`. Fiecare card este o randare reală a acelei sesiuni, nu o miniatură stocată, așa că ceea ce vezi este ceea ce se va exporta.

O singură bară laterală le conduce pe toate:

- <!--i:sliders--> **Shared** deschide lista - fiecare câmp pe care două sau mai multe dintre sesiunile selectate îl declară *la fel* (același id, același tip, aceleași constrângeri - aceeași regulă de îmbinare pe care grila de loturi o aplică pe coloanele ei). Editezi o comandă partajată o dată și valoarea se răspândește la fiecare sesiune care o declară, live pe fiecare fișă. Două sesiuni ale aceluiași instrument împart totul; două instrumente diferite împart doar ce se întâmplă să aibă în comun, și nimic altceva.
- <!--i:document--> Sub ea, **câte o fișă restrânsă pentru fiecare sesiune**, cu toate câmpurile proprii ale acelei sesiuni, la aceeași fidelitate ca bara laterală a instrumentului - selectoare de resurse, grupuri de rânduri repetabile, câmpuri de culoare - plus un bloc compact de export: **Format**, **W** / **H**, **Unit**, **DPI** și propriul **Download**. Descărcarea aceea salvează întâi sesiunea și abia apoi o randează pe calea obișnuită de export a sesiunilor, așa că fișierul poartă același nume, același format și aceleași Content Credentials pe care le-ar avea direct din instrument.
- <!--i:search--> **Filter inputs…** din capul listei restrânge comenzile de pe *fiecare* fișă deodată - și așa ajungi la "titlu" în opt sesiuni fără să-l cauți derulând.

Dă clic pe orice canvas (sau apasă Enter pe el) și fișa din bara laterală a sesiunii aceleia se deschide și intră în vedere. **Save all** scrie fiecare sesiune înapoi în slotul ei. **Download all** salvează întâi, apoi randează tot setul prin aceeași conductă ca **Render selection** din Projects - o singură arhivă zip, cu blocarea opțională prin parolă oferită pe drum.

Două limite spuse pe față. Plafonul de două-opt e real: fiecare fișă își montează propriul runtime live, iar ăsta e numărul care rămâne prompt - un link care cere mai multe (sau o sesiune care nu mai există) o spune, în loc să se încarce pe jumătate. Iar linkul numește sloturile *tale* salvate, deci redeschide setul acela pe dispozitivul ăsta; nu e un link de partajare.

Când selecția e mai mare de opt, amestecă instrumente sau include și imagini pe lângă sesiuni, ieșirea de siguranță e **Edit as sheet** din aceeași bară de selecție: deschide toată selecția ca **rânduri în grila de loturi** (`#/pro?s=…`), fără limită de mărime și fără regula aceluiași instrument. Folderele rămân în afara ambelor - ele au propria cale de deschidere în grilă. ([Căutarea](/info/search.html) e singurul lucru care încă nu ajunge aici: Multi-edit e singura vedere de care bara de căutare nu știe.)

## Offline & instalare

Lolly e un PWA. După prima încărcare funcționează **offline** - instaleaz-o din bara de adrese a browserului (sau *Add to Home Screen* pe mobil) pentru o experiență de tip aplicație, pe tot ecranul. Se actualizează singură când ești din nou online.

Despre actualizări: dacă o vizualizare nu se încarcă vreodată imediat după una (un panou gol, un \"failed to fetch\" în colț), reîncarcă pagina o dată - aplicația trece curat la noua versiune, iar munca ta, sesiunile și brandul rămân neatinse. Stochează totul pe dispozitivul tău, nu în pagină.
