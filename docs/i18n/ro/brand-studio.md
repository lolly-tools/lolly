# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, la `#/start`, conține logoul, culorile și fonturile tale. Fiecare instrument, pagină și export le folosește la desenare.

Trage un logo în aplicație, iar Lolly îi citește culorile. Alege un font sau trage fișierul fontului pentru care compania ta are licență. Fiecare modificare apare imediat în toată aplicația. Logoul, fonturile și tokenurile tale rămân pe acest dispozitiv. Doar alegerea unui Google Font accesează rețeaua: Lolly cere mai întâi confirmare, apoi descarcă familia o singură dată.

Denumește sistemul de design și apasă **Export** ca să obții un singur fișier `.lolly`. Păstrează fișierul, deschide-l pe alt dispozitiv sau dă-l unui coleg. [Lolly Settings](/info/dashboard.html#design-system) arată sistemul activ doar pentru citire; coperta lui trimite înapoi aici pentru editare.

<!--i:eti-clock-->
## Personalizează-l în cinci minute

::: timeline
- <!--i:upload--> **Trage logoul tău** în zona de plasare din **Logos**. Lolly îi citește forma și culorile.
- <!--i:palette--> **Folosește aceste culori.** Culoarea principală a logoului devine culoarea ta primară, iar o nuanță neutră închisă din logo devine culoarea textului.
- <!--i:font--> **Alege un font** în **Type**: un Google Font sau un fișier de font pe care îl deții.
- <!--i:pentool--> **Denumește sistemul.** Prima editare creează un sistem de design propriu, iar Lolly îi cere numele o singură dată.
- <!--i:download--> **Export** scrie întregul sistem într-un singur fișier `LollyBrand-….lolly`.
:::

Bara din partea de sus a studioului arată numele sistemului de design într-un câmp editabil. **Enter** păstrează un nume nou, iar **Escape** îl restabilește pe cel vechi. Când prima editare întreabă **What is this design system called?**, Lolly completează cuvintele din logo, dacă acesta le conține. **Save name** păstrează numele; **Not now** păstrează un nume provizoriu până scrii unul în bară. Numele identifică sistemul în Settings și când schimbi sistemul activ și este numele fișierului scris de **Export**.

<!--i:eti-grid-->
## Secțiunile

Studioul este un set de secțiuni fără o ordine fixă. Nicio secțiune nu depinde de alta. Pe un calculator, secțiunile stau într-o singură bandă sub bară. Pe telefon, se mută într-o bară de-a lungul marginii de jos, cu secțiunea deschisă derulată în vedere. Panoul paletei și tava se ridică deasupra acelei bare, iar bara se retrage cât scrii. Cu o tastatură, Tab ajunge la bandă o singură dată, iar tastele săgeți, Home și End te mută între secțiuni.

![Bara studioului și secțiunile lui: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules și Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Secțiune | Ce faci acolo | Cheie de link |
|---|---|---|
| **Board** | Vezi ce conține sistemul, cu acces la fiecare secțiune | `overview` |
| **Colours** | Adaugi culori, le atribui roluri, creezi nuanțe și o paletă | `color` |
| **Type** | Alegi cele patru fonturi pe care le citesc aplicația, instrumentele și fiecare export | `type` |
| **Logos** | Plasezi însemnele în fiecare orientare și variantă | `logos` |
| **Tokens** | Colțuri, spațiere, umbre și orice altă valoare denumită | `tokens` |
| **Files** | Imaginile și fișierele audio și de mișcare pe care le păstrează brandul tău | `catalogue` |
| **Sound** | Definești identitatea sonoră, muzica pentru diferite utilizări și relația cu vocea | `sound` |
| **Rules** | Regulile aplicate de brandul tău, verificate pe exemple reale | `usage` |
| **Skills** | Standardele scrise ale brandului pentru oameni și agenți, de citit și descărcat | `skills` |

Creează un link către o secțiune cu `#/start?area=<key>`. Cheile secțiunilor sunt permanente, așa că Files păstrează `catalogue`, Board păstrează `overview`, iar Rules păstrează `usage`. `?tab=` funcționează în continuare ca alias mai vechi. O cheie necunoscută deschide Board.

În **bară** se află acțiunile pentru întregul sistem. **Add from…** importă un brand ([Importă un brand](#bring-a-brand-in)). **Tray** păstrează ce a găsit o scanare și nu ai adăugat încă. **Export** scrie sistemul într-un singur fișier. **More** conține **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** și **Design systems**, care deschide lista din Settings unde schimbi sistemul activ ([Păstrează și mută sistemul de design](#keep-and-move-your-design-system)). Fiecare acțiune apare când are asupra a ce să acționeze. Pe telefon, **Add from…** se mută în **More**, iar **Export** apare ca pictogramă.

Cât timp sistemul de design este cel inclus în aplicație, bara începe cu **Make it yours**, un meniu cu **Find a look**, **Add from…** și **Pick a colour**. După ce sistemul devine al tău, **Export** ocupă din nou acel loc.

<!--i:eti-clipboard-->
## Panou

Când nu ai ales încă nimic, Board oferă patru moduri de a începe. **Start from a reference** deschide selectorul de sursă pentru un logo, o captură de ecran, o pagină web sau un fișier de design. **Pick a colour**, **Choose a face** și **Add a logo** deschid controalele respective. Deschiderea unuia nu scrie nimic. Sub ele, **Find a look** oferă culori și fonturi gata pregătite pe care să le încerci, iar **Explore the tools** este disponibil de la început.

După ce personalizezi ceva, Board arată ce ai, cu numărul elementelor proprii mai întâi. Colours arată numărul de culori, cu un `· N starter` estompat pentru cele moștenite. Banda lui arată culorile tale, apoi o linie fină, apoi culorile inițiale estompate. Colourways arată fiecare colourway ca un card mic în culoarea lui principală. Type listează fiecare rol și afișează fiecare familie în propriul font (*Inter for headings*, cu *Starter for the rest* pe rândul de dedesubt). Logos spune câte poziții sunt ocupate (sau **Not set**), Tokens arată raza colțurilor, iar Files spune **Nothing yet** cât timp biblioteca este goală. Fiecare bloc își deschide secțiunea.

Un sistem de design editabil inclus în aplicație, precum Lolly Demo, își arată de la început culorile, colourway-urile, fonturile și însemnele în Board, cu o etichetă **Came with this app** lângă titlu. Deasupra lor, **Start here** oferă **Find a look**, **Add from…** și **Pick a colour**.

### Conținut inițial și conținut propriu

În fiecare secțiune, **Starter** marchează tot ce a venit cu aplicația și nu a fost ales de nimeni. O instalare nouă nu conține nicio culoare, doar o scară neutră de la cerneală la hârtie, ca suprafețele, textul și liniile fine să poată fi randate înainte ca cineva să aleagă ceva.

::: cols
## Conținut inițial

- Inclus în aplicație: nuanțele neutre de la cerneală la hârtie, fonturile inițiale, raza implicită a colțurilor.
- Estompat, cu o etichetă **Starter** și fără tentă de culoare.
- Nu este numărat printre culorile tale. Nuanțele neutre se află în **Tokens** ca **Neutrals · starter · 9**, iar **Open** le arată în Colours ca un singur grup pliat (`#/start?area=color&group=neutral`).
- Un rol care folosește o culoare inițială arată *"Starter Paper stands in"*, cu **Choose…** pe selector.

## Conținut propriu

- Ales sau instalat de tine.
- La intensitate deplină și cu un card colorat unde ai instalat un font.
- Numărat în Board și în Tokens.
- Un rol care urmează altul arată **↳ follows Primary**.
:::

Conținutul moștenit nu are niciodată o bordură întreruptă. O bordură întreruptă înseamnă o zonă de plasare.

<!--i:eti-shapes-->
## Logouri

Zona de plasare din partea de sus, **"Drop marks here, or choose several at once"**, acceptă oricâte fișiere ai. Lolly citește forma și culorile fiecărui fișier. Fișierul așteaptă apoi sub **Waiting for a slot** ca un chip care spune cu ce seamănă, precum *"Looks like the Horizontal primary"*, cu măsurătoarea folosită și un buton **Place** (**Replace** când poziția este ocupată). Când Lolly nu este sigur, chip-ul spune asta și oferă **Change slot**, cu toate cele opt poziții listate. Nimic nu este plasat până nu apeși un buton.

Pentru un însemn cu margini goale în exces, se oferă mai întâi decuparea. Răspunde ofertei sau apasă Escape ca să plasezi originalul neatins. Când un însemn poate ocupa o poziție înrudită goală, secțiunea oferă versiunea derivată **mono** sau **reverse** ca un chip marcat *Generated*.

Fiecare însemn intră într-o grilă de opt poziții opționale, câte una pentru fiecare **orientare** și **variantă**:

- **Orientări:** Horizontal (wordmark și simbol pe un rând) și Vertical (suprapuse, pentru spații pătrate și înalte).
- **Variante:** Primary, Primary reverse (pentru fundaluri închise), Mono (o singură culoare) și Mono reverse.

Un grup fără însemne se pliază într-un singur rând; deschide grupul ca să-i vezi pozițiile. Fă clic pe o poziție ca să adaugi un PNG, SVG, JPEG sau WebP ori fă clic pe o poziție ocupată ca să înlocuiești însemnul. O poziție goală acceptă și un fișier tras pe ea. Însemnele orizontale stau în carduri late, iar cele verticale în pătrate, fiecare pe suprafața pentru care a fost creat, cu un spațiu liber de un sfert din înălțimea lui. Totul rămâne pe acest dispozitiv.

![Pozițiile pentru logo cu Horizontal și Vertical deschise: fiecare variantă are propria poziție și fiecare poziție este opțională](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** sunt însemne cărora brandul tău le dă propriul nume, precum o pictogramă, o emblemă sau un favicon.
- **Mai multe identități.** Un sub-brand, produs sau eveniment poate avea propriul set complet: apasă **+ Add another logo** și dă-i setului un nume. Setul principal este "Your logo". [Arhitecturi de brand](/info/brand-architectures.html) arată când să folosești o identitate de logo.
- **Lolly citește culorile logoului.** Un card de sub zona de plasare și din partea de sus a secțiunii Colours listează culorile logoului și întreabă **Which is the main colour?**. Este selectată culoarea cea mai puternică, niciodată albul pe care a fost exportat logoul. **Use these colours** le adaugă în paletă și face din culoarea principală culoarea ta primară. Când logoul are o nuanță neutră închisă care se distinge pe hârtie, acea nuanță devine culoarea textului. **Not now** le lasă în Tray. La o instalare nouă, Lolly aplică imediat răspunsul cel mai probabil, iar cardul oferă **Undo** sau o altă culoare principală. Un SVG oferă culori exacte; un PNG, JPEG sau WebP oferă culorile care acoperă o parte semnificativă a însemnului.

<!--i:eti-palette-->
## Culori

Secțiunea crește odată cu sistemul de design. Prima vizită cere o singură decizie; apar mai multe controale pe măsură ce paleta crește.

### Prima culoare

Un sistem fără culori proprii arată nuanțele neutre inițiale într-un grup propriu deschis. În partea de sus a secțiunii se află o zonă cu bordură întreruptă pentru lipire și plasare: un chip mare și un câmp. Trage o imagine sau o listă de culori oriunde în zonă, iar Lolly citește culorile.

- **Chip-ul este selectorul.** **Pick a colour** deschide cardul OKLCH al studioului, inițializat cu ceea ce conține câmpul. Cardul arată mai întâi numele culorii și codul hex. Spațiile de culoare, roata, cele patru cadrane și alfa se află în **Fine-tune**, iar **Cancel** și **Add colour** sunt în partea de jos. Nimic nu ajunge în sistem până nu apeși **Add colour**.
- **Câmpul acceptă orice notație**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` sau un nume de culoare. O listă lipită devine un rând de chip-uri pe care le adaugi pe rând sau cu **Add all**.
- **Încă două moduri de a adăuga.** **Pick a colour from the screen** folosește pipeta când browserul are una, iar **Take colours from an image** citește o captură de ecran sau o fotografie de pe acest dispozitiv.
- **Add nu este niciodată dezactivat.** Când câmpul este gol, deschide selectorul; pentru un text pe care nu îl poate citi, apare un rând sub câmp care spune asta.

Prima ta culoare devine **primară**. Un chip confirmă schimbarea, precum *"Primary is now Vivid Violet"*, cu **Fine-tune** pentru ajustarea culorii.


### Pe măsură ce paleta crește

Culorile tale stau lângă o previzualizare **In context** pe un ecran lat și deasupra previzualizării pe unul mai mic. Previzualizarea arată un afiș, un grafic sau un card de interfață în paleta ta. Culorile inițiale au propriul grup, care se pliază după ce sistemul are culori proprii. Zona de lipire și plasare devine un singur rând compact. Partea de sus a secțiunii nu are export; folosește **Export** din bară sau secțiunea Tokens.

![Secțiunea Colours în Lolly Demo: chip-urile de rol și zona de lipire și plasare în partea de sus, apoi paleta în grupuri pliabile, fiecare culoare cu numele și codul hex](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Secțiunea Colours în Lolly Demo după adăugarea unei culori: tabelul Colour roles, apoi chip-ul noii culori care oferă Use as Lead? și Fine-tune, lângă o previzualizare live a compoziției](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Rolurile culorilor: cum se numesc culorile

Sistemul de design dă nume culorilor și spune la ce folosește fiecare, iar Lolly citește ambele informații. **Colour roles** se află în partea de sus a secțiunii Colours. **In context** arată imediat fiecare modificare.

![Tabelul Colour roles în Wefthouse, un brand de textile inventat, în termenii lui proprii: chip-urile de colourway Indigo, Madder și Weld, apoi Main, Accent, Supporting și Tertiary, fiecare cu culoarea deschisă și cea închisă, interpretate ca fiind culoarea principală, culoarea parteneră și doar după nume, iar Background, Text, Quiet text și Hairlines sunt listate sub tabel ca interpretări pe care niciun rol nu le acoperă](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabelul are patru coloane. Pe telefon, fiecare rând devine un card cu aspectele deschis și închis alăturate:

| Coloană | Ce conține |
|---|---|
| **Role** | Cuvântul propriu al sistemului de design, pe care îl poți edita direct, și un rând care spune la ce folosește culoarea |
| **Light** și **Dark** | Culoarea din acel aspect pentru colourway-ul ales, cu numele sau valoarea ei și contrastul ei |
| **Lolly reads this as** | Ce face un instrument cu rolul, în termenii proprii ai Lolly |

**Cum interpretează Lolly un rol.** Fiecare interpretare se atribuie unui singur rol. Alegerea unei interpretări pe care o are alt rol mută interpretarea la acest rol. Lolly nu deduce niciodată sensul dintr-un cuvânt.

| Interpretare | Ce decurge din ea |
|---|---|
| **Lead colour** | Forme mari, butoane, culoarea principală folosită de un instrument |
| **Partner colour** | A doua culoare la care apelează un instrument |
| **Background** | Stă în spatele tuturor celorlalte elemente |
| **Text** | Titluri și text de corp |
| **Quiet text** | Legende și text cu caractere mici |
| **Hairlines** | Linii, borduri și separatoare |
| **By name only** | Niciun instrument nu alege rolul de la sine. Este disponibil în fiecare câmp de culoare și în Design, unde alegerea rămâne legată de rol, deci urmează colourway-ul |

O interpretare pe care nu o îndeplinește niciun rol păstrează definiția sistemului de design, iar secțiunea listează aceste interpretări sub tabel. Un rol care are același id ca interpretarea, precum un rol numit Primary, este acea interpretare și nu poate fi mutat.

**Într-un grafic.** Paleta **Design system - colour roles first** din Lolly Chart atribuie seriilor rolurile de culoare ale sistemului de design în ordinea proprie a acestuia, apoi restul paletei. Un rol interpretat ca fundal, text, text discret sau linii fine este omis, pentru că graficul își desenează fundalul și cuvintele în acele culori. Nimic nu se schimbă până când alegi acea paletă. Un sistem de design fără roluri de culoare afișează paleta ca **Design system - ordered**.

**Valori.** Apasă o valoare ca să alegi culoarea acelui rol pentru acel aspect și colourway-ul ales. **Same as light** face ca valoarea pentru aspectul închis să o urmeze pe cea pentru aspectul deschis până când alegi o culoare pentru aspectul închis. Chip-ul **Aa** arată textul pe care Lolly îl alege pentru a-l așeza pe culoare. Linia de sub valoare spune cât de lizibil este textul în fiecare aspect: **Text reads well**, **Large text only** sau **Hard to read as text**. Evaluarea privește doar textul pe culoare; culoarea poate fi în continuare potrivită pentru forme și suprafețe mari. Un rol interpretat doar după nume arată aceleași cuvinte fără culoarea de avertizare, pentru că niciun instrument nu pune text pe acel rol de la sine. Indiciul și selectorul arată cifrele, APCA mai întâi și WCAG apoi. **Own text colour** marchează o valoare al cărei fișier specifică culoarea textului; acea culoare a textului se păstrează. **Copied** marchează o valoare din alt colourway sau din culoarea parteneră pe care nu a ales-o încă nimeni; **Keep this colour** din selector confirmă valoarea.

**Puncte de plecare.** Un sistem de design fără roluri proprii arată cuvintele curente: Primary, Secondary, Surface și Text. Nu se scrie nimic până când schimbi unul. **+ Add a role** sugerează **Primary, Secondary** sau **Main, Accent, Supporting, Tertiary** ori acceptă orice cuvinte tastezi și arată interpretarea pe care ar primi-o fiecare. Primele două cuvinte devin culoarea principală și culoarea parteneră. Instrumentele continuă să deseneze aceleași culori. Într-un sistem cu o singură culoare principală, primul colourway ia numele acelei culori.

**Redenumire, reordonare, eliminare.** O redenumire schimbă doar cuvântul; tot ce folosește rolul continuă să funcționeze. Trage un rol de mâner sau apasă Space pe mâner, folosește tastele săgeți și apasă Space ca să-l plasezi. **Remove** spune ce mai folosește rolul. Când instrumentele interpretează rolul, **Remove and keep those colours** lasă fiecare interpretare cu culoarea ei curentă. O regulă a organizației, un grup de ghidaje, un câmp de instrument sau alt token care folosește rolul îl păstrează până când acea utilizare se schimbă. Un document Design salvat poate folosi și el un rol după nume, iar Lolly nu poate vedea asta din fișierul de tokenuri. Un astfel de document raportează culoarea ca nerezolvată.

::: details Roluri într-un fișier de tokenuri scris manual
**Un fișier scris manual.** Culorile dintr-un fișier de tokenuri pe care nu le declară niciun rol sunt listate sub **In this file, with no role yet**, fiecare cu un câmp pentru un cuvânt și **Make a role**. Ele continuă să funcționeze după nume în ambele cazuri. Un token cu cifre în nume nu poate fi un rol; rămâne în fișier și continuă să funcționeze prin calea lui. Dacă o înregistrare din fișier nu trece validarea, tabelul apare fără controale și spune de ce.
:::

**Restul secțiunii folosește aceleași cuvinte.** Chip-urile, rândul **Use as** al mostrei și grupul **Colour roles** al paletei folosesc toate cuvintele sistemului de design. Cardul unui rol de culoare deschide valoarea lui. Fișierele exportate nu înregistrează nimic nou despre roluri; culorile unei randări se schimbă pentru că s-au schimbat tokenurile.

**Unde ajung cuvintele.** Cuvintele și descrierile călătoresc cu sistemul de design. Agenții le citesc în brieful de design, în `lolly://tokens` și în fișierul `AGENTS.md` al unei pagini de brand. Terminalul le arată în `lolly system status`. O pagină de brand le listează în `brand.json` și măsoară o pereche de contrast pentru fiecare rol. Fișierele DTCG și Tokens Studio păstrează totul, `DESIGN.md` păstrează cuvintele și interpretările, iar o temă PowerPoint păstrează doar ordinea brandului. [Roluri de culoare în alte formate](/info/design-tokens.html#colour-roles-in-other-formats) are lista completă. Cuvintele sunt mereu citate ca date ale sistemului de design, niciodată interpretate ca instrucțiuni.

**Unde alegi o culoare.** Fiecare câmp de culoare dintr-un instrument și din Lolly Design listează mai întâi rolurile sistemului de design, în ordinea proprie a acestuia, cu fiecare cuvânt și scopul lui. **Aa** de lângă un rol alege culoarea care stă pe acel rol. Celelalte culori urmează sub **Other colours**, fără copiile proprii ale unui colourway, culorile pentru conținutul suprapus și orice interpretare pe care o îndeplinește deja un rol. O alegere rămâne legată de rol și urmează colourway-ul. Câmpul arată cuvântul în fiecare colourway, iar Settings și Tokens folosesc și ele cuvântul. Un sistem de design fără roluri își păstrează grila de mostre.

### Fiecare culoare pe care o citește un instrument

Cu **Colour roles** închis, secțiunea începe cu chip-uri pentru primele decizii. Fiecare chip arată culoarea rolului și numele lui. Într-un sistem fără cuvinte proprii, acestea sunt **Primary**, **Secondary**, **Surface** și **Text**. Apasă un chip ca să-i alegi culoarea din mostrele paletei. **Every colour a tool reads**, în partea de jos a **Colour roles**, conține banda completă.

Banda arată cele șapte culori pe care le poate citi un instrument: Primary, Secondary, Surface, Text, Muted, Edge și On primary, în cuvintele proprii ale sistemului de design acolo unde le are. Fiecare joacă același rol în fiecare instrument și export. Niciuna nu trebuie setată obligatoriu și orice culoare poate ocupa unul dintre locuri. Trei culori neatribuite pot forma un sistem bun. Afișajul spune cât de lizibil este textul pe suprafață, cu APCA mai întâi. Fiecare rând arată culoarea ta la intensitate maximă, o culoare de pornire care o înlocuiește sau **↳ follows Primary**.

On primary este derivată din culoarea primară, este etichetată **Derived** și nu are selector. Comutatorul **Light** și **Dark** de lângă On primary și cel de lângă **In context** aleg aspectul pe care îl arată banda, paleta și previzualizarea.

Accentul propriu al aplicației urmează implicit sistemul de design, prin setarea **Interface follows the design system** din **Settings → Appearance**. Cu setarea oprită, interfața aplicației rămâne neutră. Instrumentele, canvasurile și exporturile urmează sistemul de design în ambele cazuri.

**Colourway-uri.** Un sistem de design poate conține mai multe culori principale, alese pentru fiecare piesă. Rândul **Colourways** de la începutul **Colour roles** arată un chip pentru fiecare colourway, cu **Default** pe cel canonic. **+ Add** începe un colourway nou dintr-o culoare a paletei. Alege un chip și tabelul, banda, paleta și previzualizările arată acel colourway. Poți redenumi, duplica, elimina sau seta ca implicit colourway-ul ales. Într-un sistem cu colourway-uri, fiecare colourway are nevoie de propriile culori primară și secundară și de propria suprafață atunci când colourway-urile colorează fundalul. Aceste roluri rămân setate în editorul de mostre. [Adaugă colourway-uri într-un sistem de design](/info/colourways.html#add-colourways-to-a-design-system) conține pașii și formatul tokenurilor, iar [Lolly Demo în uz](/info/lolly-demo-in-use.html#colourways-on-real-work) arată colourway-uri pe muncă reală. Fiecare persoană își poate alege un colourway propriu în **Settings → Appearance** ([Alege un colourway propriu](/info/colourways.html#make-a-colourway-your-own)).

### Găsește mai multe culori

Trei instrumente pornesc de la culoarea ta primară. Primele două doar sugerează; al treilea înlocuiește paleta.

::: cols
## Explorează nuanțe & armonii

Alege o **Starting colour**, o **Scheme** (Mono, Complement, Analogous sau Triad) și câte **Shades** vrei (de la 3 la 20, implicit 5). **Fine-tune** setează intensitatea interfeței, contrastul și textul pe culoarea de brand. Fă clic pe o nuanță ca s-o adaugi sau pe **Add 5 shades** pentru un grup. Culorile și rolurile tale se păstrează.

## Găsește culori potrivite

Alege o **Harmony**: Complementary, Adjacent, Triad, Tetrad sau Analogous (cu **Accents** de la 2 la 5 și un **Angle** de la 10° la 45°). Fiecare variantă are un nume generat și **+ Add**, o apăsare pentru fiecare culoare.

## Reconstruiește întreaga paletă

Înlocuiește paleta pornind de la o singură culoare, după o examinare a ceea ce se schimbă și a ceea ce se păstrează.
:::

Toate trei folosesc aceleași calcule perceptuale de culoare (OKLCH) ca motorul. În **Explore shades & harmonies**, rândurile **Primary**, **Neutral** și **Secondary** arată nuanțele sugerate, iar **Theme preview** arată exemple deschise și închise cu măsurătorile lor de contrast.

![Trei grupuri de nuanțe sugerate, cu controale individuale de adăugare și o previzualizare Theme preview separată](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Accente generate, fiecare cu o mostră, un nume generat automat, codul hex și un buton Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Aplicarea unei palete generate

Deschide **Rebuild the whole palette…** și apasă **Preview full rebuild**. Examinarea numără câte roluri rămân așa cum le-ai atribuit, câte dintre culorile tale se păstrează și câte curbe de nuanțe, valori blocate pentru tipar, nuanțe ascunse și stopuri de gradient sunt reancorate sau păstrate. **Apply rebuilt palette** aplică schimbarea; **Cancel** nu schimbă nimic. După aceea, cardul oferă **Undo**, cu focusul deja pe el, iar punctul de restaurare creat înainte de înlocuire restaurează întregul sistem.

Un sistem cu colourway-uri păstrează fiecare colourway la reconstruire. Colourway-ul canonic urmează noua culoare de pornire, iar fiecare alt colourway își păstrează culorile, numele, ordinea și setările proprii. Examinarea listează care colourway urmează noua culoare și care își păstrează culorile. Lolly nu reconstruiește un sistem care își codifică colourway-urile într-un mod pe care nu îl poate edita; cardul spune de ce și nimic nu se schimbă.

### Secțiunile pentru experți

Patru secțiuni pliate se află sub previzualizare și roluri. Fiecare se deschide cu `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) remodelează o rampă punct cu punct, cu curbe separate de luminozitate, cromaticitate și nuanță (L / C / H), iar nuanțele se redesenează în timp ce tragi.
- **Contrast** (`focus=contrast`): **Contrast-lock** ajustează tonurile unei rampe pentru a atinge țintele APCA pe un fundal ales de tine, iar **Rotate hue** rotește întreaga rampă pe roata culorilor.
- **Print** (`focus=print`) setează ce devine culoarea primară la tipar: valoarea ei automată, o combinație CMYK fixată sau o cerneală spot cu nume.

### Paleta și fiecare mostră

Paleta listează culorile tale în grupuri pliabile, fiecare cu propriul **+ Add**. Poți crea și redenumi grupuri. Un rol nu creează niciodată un al doilea card; cardul la care trimite un rol arată numele rolului, precum **Primary**. **Colour chart** de sub carduri arată aceleași culori pe **Wheel** în OKLCH (trage un punct ca să-i schimbi culoarea, fă clic pe un spațiu gol ca să adaugi o mostră) și pe diagrama **Gamut**, care arată unde se termină gama ce poate fi afișată. `#/start?area=color&focus=chart` deschide diagrama.

![Panoul paletei, cu fiecare grup pliabil](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roata OKLCH - unghiul este nuanța, distanța față de centru este cromaticitatea, iar tonurile de gri urmează o bandă de luminozitate pe lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Fă clic pe o mostră ca să-i deschizi editorul:

- **Redenumește** mostra.
- **Setează culoarea** cu glisoarele OKLCH sau în **Hex**, **HSL**, **RGB** ori **CMYK**. Câmpul valorii citește și scrie în spațiul activ. CMYK aici setează culoarea de ecran prin conversie; ca să fixezi cerneluri exacte, folosește **Print substitutes**.
- **Stored as** alege cum se salvează mostra: **LCH** (implicit, perceptual și cu gamă largă), Hex, RGB sau HSL.
- **Use as** îi atribuie mostrei un rol, în cuvintele proprii ale sistemului de design acolo unde le are. Apasă din nou un rol evidențiat ca să-i anulezi atribuirea.
- **Print substitutes** (pliat): blochează **CMYK** de la **Auto** la valori exacte de cerneală sau setează o **Spot colour** cu un **Name** (precum `PANTONE 186 C`), un **Book** opțional și un **Finish** pentru folie, relief, adâncire, lac selectiv, finisaj catifelat sau ștanțare, biguire ori perforare. Tiparul folosește aceste valori blocate când exporți un PDF sau TIFF CMYK; vezi [Profiluri de culoare](/info/exporting.html#colour-profiles). O cerneală spot se tipărește pe propria placă într-un Print PDF; ca să tipărești fiecare cerneală spot în culori de proces pentru un singur export, vezi [Cerneluri spot în culori de proces](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (pliat): o valoare pentru fiecare spațiu de culoare, derivată sau definită de tine, iar cea definită de tine are prioritate la export.

**Ștergerea unei mostre** este sigură. Nuanțele derivate și rolurile temei sunt ascunse, așa că nimic din ce le citește nu se strică. Culorile pe care le-ai adăugat sunt eliminate.

::: details Lucrul cu multe mostre
În starea obișnuită, o mostră își arată culoarea, numele și codul hex. Select arată caseta de bifare și mânerul de tragere ale fiecărei mostre pe orice ecran, iar un card cu focusul de tastatură își arată și el mânerul. Trage un mâner ca să reordonezi în cadrul unui grup sau mută focusul pe mâner, apasă Space, folosește tastele săgeți și apasă din nou Space ca să-l plasezi; Escape anulează. Pe telefon, paleta arată patru culori pe rând. Ca să muți culori între grupuri, folosește controlul **Group** al editorului sau selectează mai multe și folosește **Move to**.

Selecția nu are nevoie de un comutator separat: bara și casetele de bifare apar odată cu primul card selectat și dispar odată cu ultimul.

- **Trage pe un spațiu gol** ca să desenezi un dreptunghi; fiecare card pe care îl atinge intră în selecție, chiar și din grupuri diferite. O secțiune pliată nu adaugă nimic.
- **Shift-clic** selectează un interval în ordinea de citire, **Cmd/Ctrl-clic** comută selecția unui card, iar un clic simplu deschide editorul.
- Fiecare antet de grup are **Select all**, iar **Cmd-A**, cu focusul pe un card, selectează fiecare culoare proprie, niciodată una de pornire.
- Grila are un singur punct de oprire pentru Tab: săgețile mută, Shift-săgeți extind, Space comută, Delete elimină și Escape golește selecția. Ca să ajustezi un canal în pași mici, apasă mai întâi `l`, `c` sau `h`.
- Pe un ecran tactil, apasă lung pe un card ca să începi o selecție, apoi atinge ca să adaugi.

Bara arată **{n} selected**, apoi **Move to**, **Give a role** (fiecare culoare primește pe rând rolul următor), **Download** (selecția în oricare dintre cele șase formate de paletă), **Duplicate** (o copie a fiecăreia, plasată după original), **Copy values** și **Delete**. O singură copie se deschide în editor; mai multe rămân selectate. Un singur Cmd/Ctrl-Z anulează o acțiune în masă.
:::

### Gradiente

Panoul opțional **Gradients** construiește tokenuri de amestec din paletă. Fiecare gradient are o previzualizare, între 2 și 8 stopuri cu nume și un unghi. Un stop trimite la o mostră, așa că, dacă schimbi culoarea mostrei, gradientul o urmează. Amestecurile se fac în OKLCH.

Descărcările paletei (tokenuri de design, CSS, SCSS, GIMP și Adobe Swatch Exchange) se află în antetul paletei. [Ia-ți paleta și fonturile oriunde](/info/using.html#take-your-palette-and-fonts-anywhere) descrie fiecare format.

<!--i:eti-type-->
## Tipografie

Fără un font propriu, secțiunea arată un singur card: **Primary**, la dimensiune de citire în fontul curent, cu o etichetă **Starter**, un buton **Choose for Primary** și rândul *„Nu se instalează nimic până când alegi un font.”* Titlurile, codul și cursivele urmează fontul primar până când le alegi; **Choose them separately** arată cardurile lor.

![Secțiunea Type fără niciun font ales încă - un card la dimensiune de citire, cu o etichetă Starter și un singur buton plin Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Alege un font și secțiunea se extinde la patru carduri de roluri, lista Fonts și un specimen live:

- **Primary**: text de corp, butoane și fiecare instrument.
- **Headings**: fontul de afișare pentru `h1` și `h2`.
- **Code**: un font monospațiat pentru cod și date.
- **Italic**: un cursiv autentic pentru evidențiere, citate și observații secundare.

Un card este colorat doar acolo unde ai instalat acel font. Butonul lui arată rolul: **Change Headings** pe un font propriu și **Choose for Headings** în rest. Linia de probă trece pe rânduri noi. Nimic de pe un card nu aplică o schimbare; butonul deschide zona de comparare pentru acel rol.

![Cele patru carduri de roluri dezvăluite - fiecare în fontul care îl deservește, cu o etichetă Starter unde nimeni nu a ales unul și Italic urmând fontul primar](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Zona de comparare

Zona se deschide sub cardul pe care l-ai apăsat. Cardurile se strâng într-o bandă de un rând, astfel încât zona să fie vizibilă pe primul ecran al telefonului. Escape anulează și readuce focusul pe card.

1. Apasă **Choose for** și rolul de pe card.
2. Tastează numele unei familii de fonturi și apasă **Preview** sau apasă una dintre cele șase familii **Pinned** de sub câmp.
3. Apasă **Use this face**.

![Zona de comparare deschisă sub cardul ei, cu rândul de căutare, familiile fixate și cardurile strânse într-o bandă de un rând](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Consimțământul se cere o singură dată.** Prima dată când o previzualizare contactează Google Fonts, un dialog explică: *Google află numele familiei de fonturi și adresa ta IP. Fișierul este apoi păstrat pe acest dispozitiv și folosit offline. Acesta este singurul pas din studio care contactează o terță parte.* **Fetch from Google** continuă și alegerea este memorată. **Cancel** lasă cardul cu textul *„Nu s-a preluat. Nu s-a trimis nimic către Google.”*, cu propriul **Fetch from Google**.

**Plasează un fișier de font în zonă** (TTF, OTF sau WOFF) ca să previzualizezi un font pe care îl deții cu licență. În ambele cazuri, fontul rămâne pe acest dispozitiv, se randează offline în aplicație, în instrumente și în fiecare export și călătorește în fișierul sistemului de design. Tot ce este pe Google Fonts se distribuie sub o licență deschisă (OFL, Apache sau UFL).

### Fonturi pe acest dispozitiv

Panoul **Fonts** listează fiecare font de pe acest dispozitiv și rolul pe care îl îndeplinește. Fonturile pe care le-ai adăugat apar primele, sub **In the design system**, fiecare cu rolurile lui și o acțiune de ștergere. Fonturile de pornire urmează într-un singur rând discret, pliat. **Add a face** deschide zona de comparare pentru orice rol. Panoul **Type roles** arată un specimen live al fiecărui rol, cu familia și starea lui, precum *Inter* sau *Inter · follows Primary*.

<!--i:eti-tag-->
## Tokenuri

Tokenurile sunt valorile cu nume din spatele sistemului de design: culori, fonturi, logouri, colțuri și spațiere. Instrumentele le citesc după nume, așa că o schimbare aici ajunge la fiecare instrument deodată.

![Secțiunea Tokens: antetul cu un exemplu din sistem și acțiunile pentru fișiere, carduri care numără fiecare tip de token, apoi perechile de culori cu valorile lor de contrast](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Antetul** oferă un exemplu din propriul tău sistem (*Primary este Spearmint, #033633*) și acțiunile pentru fișiere: **Download** (sistemul ca tokenuri de design sau paleta în alte cinci formate), **Copy CSS** și **Add from…** pentru a citi înapoi un fișier JSON.
- **Cardurile** numără fiecare tip de token și te duc la secțiunea lui: Colours, Type, Logos, Shape and spacing, More și All tokens. O secțiune care conține doar ce a venit cu sistemul de pornire gol poartă o etichetă **Starter**; un sistem care a venit cu aplicația își numără propriul material fără etichetă. Pe telefon, cardurile se așază pe două rânduri de câte trei.
- **Colours** începe cu perechile pe care le alătură instrumentele (text pe suprafață, pe culoarea primară, text discret pe suprafață), cu o valoare APCA în aspectul deschis și în cel închis, și semnalează **Weak contrast** acolo unde o pereche nu atinge pragul. Apoi fiecare grup de culori: o rampă ca un singur rând de chip-uri, alte culori cu valoarea lor și referința pe care o folosesc instrumentele, precum `{color.brand.spearmint}`. Apasă o referință ca s-o copiezi. **Edit in Colours** deschide un grup în secțiunea Colours. Într-un sistem de design cu [roluri de culoare](#colour-roles-what-the-colours-are-called), **Colour roles** apare primul, cu fiecare rol o singură dată, în cuvintele și ordinea proprii ale sistemului. Un rol păstrează o culoare pentru fiecare colourway și aspect. Aceste culori sunt listate cu rolul, nu ca culori separate; schimbă-le în tabelul Colour roles.
- **Type** și **Logos** listează fontul pentru fiecare rol și fiecare loc de logo, cu **Edit in Type** și **Edit in Logos** odată ce ai elemente proprii.
- **Shape and spacing** conține **Rounded corners** (`shape.radius`) și **Spacing rhythm** (`space.base`). Fiecare arată *Lolly default* până când muți glisorul și *Yours* după aceea, se salvează imediat și poate fi anulat.
- **More tokens** adaugă spațiere, dimensiuni, grosimea conturului, opacitate, rotire, numere simple și umbre, stocate ca [tokenuri de design](/info/design-tokens.html) standard.
- **App appearance (advanced)** listează culorile, dimensiunile și umbrele folosite de ecranele proprii ale Lolly, iar **Inspect every token (advanced)** caută și editează orice valoare stocată și arată mai întâi fiecare schimbare pentru examinare. Acolo, valorile unui rol de culoare în fiecare colourway sunt listate cu rolul: alege tokenul rolului ca să vezi un rând pentru fiecare colourway, cu aspectul deschis și cel închis alăturate. Linia cu numărul total spune câte valori conțin rolurile. Un sistem de design doar pentru citire arată aceeași listă.

O secțiune goală oferă **Pick a colour**, **Choose a face** sau **Add a logo**.

<!--i:eti-images-->
## Fișiere

Plasează fișierele pe care le păstrează brandul tău, în afară de logouri: fișiere **vectoriale**, **imagine**, **audio** și **de mișcare** (video, Lottie și animații). Apar în [Assets](/info/using.html#assets-your-library), sortate în secțiuni, și în selectorul de resurse al fiecărui instrument. Rămân pe acest dispozitiv.

## Sunet

**Sound** se alege prin ascultare. Secțiunea se deschide cu trei sunete de pornire, **Calm**, **Steady** și **Bright**, fiecare un card în culorile genului său, cu un buton de redare. Redă unul ca să auzi un fragment scurt; pornirea altuia îl oprește pe primul. **Choose** face acel sunet comun tuturor utilizărilor. Al patrulea card, **Mixed**, îi dă fiecărei utilizări propriul sunet: Calm pentru Explain, Steady pentru Demonstrate și Bright pentru Play. Butonul lui de redare le redă pe cele trei pe rând. Nu se salvează nimic până când alegi **Save sound**. Sunetul devine apoi parte din acest sistem de design, cu un punct de restaurare în același istoric pe care îl folosesc celelalte secțiuni. Un sistem de design fără sunet continuă să funcționeze ca înainte.

O utilizare este un moment în care se redă sunetul: **Explain**, **Demonstrate** și **Play** pentru început. Fiecare utilizare este un chip cu propriul buton de redare. **Music** sau **With narration** deasupra chip-urilor setează dacă un chip redă doar muzica sau muzica sub o voce. Utilizarea pe care o alegi își arată scopul și muzica în cuvinte simple, de exemplu „Cald · 84 bpm · Rhodes, bas fluid, tobe cu timbru vintage”. Fiecare utilizare preia genul, tempoul și instrumentele sunetului ales (sau, cu Mixed, pe cele proprii). Fiecare utilizare își păstrează melodia și echilibrul proprii: Explain lasă vocea să se audă fără ca melodia să o acopere, iar Play lasă melodia în prim-plan. Trecerea între Mixed și un singur sunet le păstrează pe ambele. O utilizare pe care ai adăugat-o tu păstrează sunetul pe care îl are în Mixed. Sistemul de design înregistrează ce ai ales. **Add a use** adaugă o utilizare și îți permite să-i tastezi numele pe loc. **Make main** alege utilizarea redată când nu se cere altceva. **Another tune** redă o compoziție nouă cu aceleași setări.

**Edit in the music generator** deschide [generatorul de muzică](/info/generated-music.html#the-music-generator) cu setările acelei utilizări, cu o linie sus care spune al cui sunet îl editezi. **Save to this use** aduce setările înapoi în secțiune; **Cancel** revine fără nicio schimbare. Alegerile nesalvate din secțiune așteaptă cât timp ești plecat. Dacă cineva salvează între timp sunetul în altă filă, salvarea mai nouă rămâne valabilă, iar editarea ta este omisă.

**Voice** alege o voce pentru utilizare, viteza vorbirii și volumul muzicii sub voce; **Hear the voice with the music** le redă pe ambele. Sub **More** se află reducerea volumului în timp ce vorbește vocea, cuvintele de probă (rămân în secțiune), notele de pronunție (una pe rând, în forma scris = rostit) și notele despre voce. Previzualizările folosesc modelul vocal local și același mixaj ca exportul unei secvențe. O previzualizare se stinge treptat; nu este un final compus.

**Notes and signature** conține ce trebuie să urmărești la ascultarea unei utilizări și o semnătură sonoră: o introducere sau un final fix, păstrat ca fișier audio propriu. Plasează semnătura în secvența ta; muzica generată nu include niciodată semnătura. O cerință pe care această versiune Lolly nu o poate verifica oprește crearea de muzică nouă pentru acea utilizare.

**Details** conține caracterul brandului (ce senzație ar trebui să transmită sunetul, ce rămâne la fel și ce trebuie evitat) și evaluarea prin ascultare. **Record a listening review** păstrează numele evaluatorului, data și notele lui asociate versiunii salvate a sunetului. Orice schimbare face sunetul din nou o ciornă. O evaluare acoperă acea versiune, nu fiecare melodie creată ulterior din sunet: ascultă fiecare piesă nouă înainte să o distribui.

**Make a music project** deschide utilizarea în generatorul de muzică sub forma unui proiect care păstrează utilizarea, versiunea sunetului și setările exacte. **New tune** creează acolo o compoziție nouă și păstrează sunetul. Dacă schimbi setările, **Put the sound back** revine la sunet, iar **Keep as my own** continuă cu o melodie independentă. Până când alegi, proiectul nu poate fi salvat sau descărcat ca fiind creat din sunet. Linkurile de partajare conțin doar setările muzicii. Proiectul și o melodie salvată păstrează și notele sunetului, care nu intră în linkurile de partajare și în acreditările publice ale fișierului audio. Păstrează o înregistrare randată când sunetul exact trebuie să reziste versiunilor viitoare ale generatorului.

<!--i:eti-checklist-->
## Reguli

**Rules** stabilește ce pot schimba oamenii, ce rămâne fix și ce poate verifica Lolly.

![Rules pe Lolly Demo: patru reguli ale organizației, fiecare marcată Checked in Design și Required sau Advisory, apoi Try your design system in use cu exemplele gata de randat](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** listează regulile tale. **Add rule** (sau **Add your first rule**) deschide un formular scurt:

- un **Rule name** în cuvintele tale, precum *Accente Beacon*;
- verificarea **Check**: **Colour choices**, **Font choices**, **Fixed artwork** sau **Text length**, cu rolul de brand pe care îl folosește, sub numele dat de tine rolului;
- exemplul **Example** căruia i se aplică (Poster, Title slide, Content slide sau Lolly Chart), modul **Mode** și dacă este **Required** sau **Advisory**;
- **Reviewed by**, apoi **Save draft** sau **Approve & save**.

Aprobarea înregistrează propria ta decizie pe acest dispozitiv. Regulile obligatorii aprobate limitează afișul reutilizabil, iar verificările acoperă doar PNG-urile de exemplu; nu schimbă niciun alt instrument.

Regulile din fișierul de tokenuri al unui sistem de design, precum perechi de culori aprobate, grosimea și alinierea textului sau un logo pentru fiecare suprafață, sunt listate aici ca **Checked in Design**. Lolly Design le verifică strat cu strat în cardul **Before you export** din panoul de export, iar `lolly check` face același lucru pentru un document Lolly Design salvat ([Înainte să exporți](/info/design.html#before-you-export)). O regulă pentru care această versiune nu are un verificator este păstrată așa cum a fost furnizată și marcată **Unchecked**.

Lolly Demo aduce patru reguli aprobate ale organizației. Titlurile nu sunt niciodată scrise integral cu majuscule: acea regulă este obligatorie, așa că `lolly check` raportează un titlu scris cu majuscule ca eroare. Celelalte trei sunt recomandări. Textul de corp este aliniat la stânga. Mărcile primare stau pe suprafețe deschise, iar mărcile inversate pe cele închise. Liniile întrerupte înseamnă plasează aici.

**Try your design system in use** randează patru exemple din revizia curentă cu **Render & check examples**. Alege un **Mode** și **Try your own text** pentru titlu, textul secundar și textul diapozitivului. Fiecare exemplu raportează ce s-a măsurat, cu **See checks & sources** și **Download check report**. **Make reusable poster** descarcă un `.lolly` care conține layoutul fix și opțiunile de intrare aprobate. Exemplele sunt locale: rularea unei verificări nu publică și nu aprobă nimic.

O versiune distribuită cu un brand fix arată aceleași reguli și exemple doar pentru citire, sub *This brand is set*.

<!--i:eti-graduation-cap-->
## Skill-uri

**Skills** listează [skill-urile de brand](/info/brand-skills.html) ale sistemului de design activ: standardele scrise ale brandului, câte unul pentru fiecare disciplină, pentru oameni și agenți AI. Fiecare rând arată disciplina, starea stabilită de brand (**Draft** sau **Approved**), dacă skill-ul este public sau intern și revizia lui. Alege un rând ca să citești skill-ul împreună cu acoperirea lui, care compară liniile skill-ului cu tokenurile tale: ce verifică Lolly, ce intră în conflict, ce se potrivește și ce este doar orientare.

**Download skill (.zip)** scrie skill-ul ca dosar Agent Skills pentru un instrument de agent, cu linkuri de catalog care trimit la acest Lolly. **Copy as one file** pune același text în clipboard pentru o fereastră de chat. Un sistem de design fără skill-uri proprii listează o bază pe care Lolly o scrie din tokenurile și regulile organizației de fiecare dată când baza este citită. Secțiunea citește skill-uri și nu le editează niciodată.

<!--i:eti-upload-->
## Importă un brand

**Add from…** din bară deschide un selector care întreabă ce ai, nu în ce format este:

- **Design tokens or a design file**: JSON DTCG sau Tokens Studio, un proiect Penpot, o arhivă zip de seturi de tokenuri, un pachet de sistem de design Lolly, un SVG, un `DESIGN.md` sau un dosar de pagină de brand.
- **PDF**: un deck sau un fișier de ghiduri, citit pe acest dispozitiv pentru culorile, mărcile și fonturile încorporate.
- **Logo or screenshot**: o imagine devine o paletă sugerată, citită pe acest dispozitiv. Citește culorile, nu fontul sau layoutul.
- **Saved web page**: un fișier HTML și fișierele lui CSS sau HTML ori CSS lipit, până la 20 de fișiere și 2 MB. Se citește doar textul pe care îl furnizezi: resursele legate nu sunt preluate și scripturile nu rulează.
- **Font file**: TTF, OTF sau WOFF. Deschide secțiunea Type, unde se instalează fontul.
- **Website**: o pagină, citită pentru culori și tipografie. Acest card apare doar pe un dispozitiv care poate citi o pagină și spune ce mecanism de citire folosește: aplicația de pe acest dispozitiv sau extensia de browser într-o filă din fundal, autentificată cu identitatea ta. Tastarea unui URL doar completează câmpul; apăsarea butonului de preluare reprezintă consimțământul.

Alege sursa de fișier de design și următorul card listează formatele acceptate sub formă de carduri cu pictograme. Cardul este o singură zonă de plasare. Poți și să plasezi un fișier în studio.

![Cardul de import - formatele acceptate apar primele ca niște carduri cu pictograme, iar întregul card este o singură zonă de plasare](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Un **pachet de sistem de design Lolly** (`.lolly` sau un `.zip` vechi) se instalează într-un singur pas.
- Un export **Penpot** (`.penpot`) aduce tokenurile lui de design.
- Un fișier **Design Tokens** (W3C DTCG) sau **Tokens Studio** (`.json`) aduce tokenurile lui. O descriere care îi cere cititorului să ignore instrucțiunile, pretinde că acordă permisiuni sau cere rularea de cod este omisă, iar importul spune unde se afla.
- Un **SVG simplu** este scanat pentru culori dintre care alegi, prima devenind culoarea ta primară.
- Un **`DESIGN.md`** (`.md`) ajunge la **Try these colours** cu tokenurile așa cum sunt scrise. Proza lui poate fi păstrată ca ciornă de skill de brand, iar cardul semnalează liniile care îi cer cititorului să ignore instrucțiunile, pretind că acordă permisiuni sau cer rularea de cod. Agenții și paginile de brand nu văd o ciornă până când apeși **Keep this skill** în secțiunea Skills, iar un skill păstrat rămâne intern.
- Un **dosar de pagină de brand**, ales ca dosar, plasat sau arhivat în zip, ajunge la aceeași examinare. Fiecare fișier este verificat față de `brand.json` din dosar; un singur fișier care nu se potrivește duce la respingerea întregului dosar. Importul adaugă tokenurile. Logourile și fonturile rămân în dosar.

::: warning Verificarea instrucțiunilor citește linie cu linie
Verificarea care omite instrucțiunile din descrierile unui fișier de tokenuri citește linie cu linie și nu detectează alte formulări. Citește un fișier de la cineva pe care nu îl cunoști înainte să aplici tokenurile.
:::

Lolly citește o pagină de brand din fișierele pe care le furnizezi. Nu accesează adresa altui site.

### Un fișier cu propriile cuvinte pentru culori

Un fișier de tokenuri sau un `DESIGN.md` poate folosi propriile cuvinte pentru culori, precum main, accent, supporting și tertiary. Când Lolly găsește astfel de cuvinte, examinarea listează fiecare cuvânt înainte de a aplica ceva: cuvântul, culoarea lui în fiecare aspect, tokenul din care provine și interpretarea sugerată de Lolly. Lolly sugerează interpretări doar din cuvinte, pe baza unei liste scurte, fără model. Un cuvânt din afara listei este preluat ca fiind propriu brandului, **By name only**. Poți redenumi orice cuvânt, spune la ce folosește, atribui o altă interpretare sau debifa pentru a-l păstra ca o culoare cu nume.

**Install with these roles** scrie rolurile; **Install without roles** instalează fișierul așa cum a venit. Un fișier fără astfel de cuvinte sare peste acest pas. Un fișier care își declară propriile roluri, precum unul scris de Lolly, le arată așa cum sunt scrise și le instalează neschimbate; le poți edita mai târziu în secțiunea Colours. Terminalul nu are examinare: `lolly system import` păstrează o înregistrare declarată și lasă cuvintele celorlalte fișiere ca nume de culori.

### Examinează o referință

Un logo, o captură de ecran, un site sau o pagină salvată deschide **Try these colours**: un exemplu în culorile propuse, o **Main colour** pe care o poți schimba și un nume pentru un sistem nou. O casetă spune ce face aplicarea: **înlocuiește** setările active ale tokenurilor cu paleta generată și stilurile implicite, **păstrează** fonturile și fișierele din bibliotecă, iar sistemul anterior poate fi **recuperat**. **Apply suggested settings** creează un punct de restaurare, apoi aplică paletele deschisă și închisă. **Restore brand settings** poate readuce setările vechi. **Change reference** alege altă sursă.

::: details Ce se citește dintr-o referință și raportul de context de design
**Palette, source details and individual choices** arată ce s-a citit, orice nume de font găsite și contrastul previzualizării. Numele de font sunt doar sugestii; instalezi un font în Type. Detaliile sursei pot include tipografie, intervale, padding și valori ale colțurilor acolo unde au fost observate, etichetate **Not observed** în caz contrar. O pagină salvată sau citirea nativă a unui site raportează stiluri declarate, pe care pagina s-ar putea să nu le folosească. Extensia de browser poate raporta stiluri măsurate dintr-un eșantion de elemente vizibile. Acestea sunt observații: nu se instalează nimic, iar spațierea sursei nu o înlocuiește niciodată pe a ta. **Choose individual items in the tray** păstrează elemente individuale. **Download design context** salvează un raport JSON cu observații, tokenuri propuse și informații despre sursă (cu un SHA-256 pentru orice HTML sau CSS furnizat). Raportul nu conține textul brut al paginii și nu este un Content Credential semnat.
:::

Importurile de PDF și fișiere de design își păstrează propriile controale de examinare. Elementele din **Tray** nu schimbă nimic până când le adaugi în secțiunea căreia îi aparține acel tip de material. `#/start?source=<kind>` deschide selectorul pe o sursă (`file`, `pdf`, `image`, `font`, `url`, `page`), iar `?import` deschide lista simplă.

### Găsește și compară un aspect

Deschide **Find a look** din Board sau din lista de sisteme de design din Settings. Răsfoiește sistemele salvate pe acest dispozitiv și câteva exemple Lolly reutilizabile și caută după nume, etichetă de culoare sau font declarat. **Closest to my current palette** sortează după similitudinea măsurată a culorilor, iar fonturile identice departajează egalitățile; nu este un scor de calitate.

Fă clic pe un aspect ca să-l previzualizezi în context; previzualizarea nu schimbă nimic. **Use this look** de pe un card aplică acel aspect. Un sistem salvat devine cel activ, fără să editeze nimic. Culorile unui exemplu intră în sistemul de design deschis după punctul de restaurare obișnuit. Logourile, fonturile și orice altceva ce exemplul nu definește în sistem rămân așa cum sunt. **Compare looks** adaugă o casetă de bifare pe fiecare card: alege două ca să le compari alăturat. **Restore brand settings** recuperează aspectul anterior. Sistemele salvate au **Search tags** editabile sub **Details and design context**. Exemplele sunt rețete de culori originale Lolly, fără colecții extrase de pe site-uri și fără cont.

![Lolly compară Sunroom și Orchard alăturat înainte de a aplica oricare dintre sistemele de culori.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Păstrează și mută sistemul tău de design

### Mută un brand între dispozitive

**Export** scrie un singur fișier **`LollyBrand-….lolly`**: tokenurile, fonturile, logourile și preferința ta de temă, cu un manifest de integritate verificat la import. Versiunile web de dinainte de 1.0.7 numeau fișierul `.zip`, iar Lolly acceptă în continuare acea extensie. **Tokens (.json)** scrie documentul simplu de tokenuri de design, fără fonturi sau logouri, pentru un depozit de cod, un pas de build sau alt instrument de tokenuri.

Ca să imporți unul înapoi, folosește **Add from… → Design tokens or a design file** sau plasează fișierul în studio. Așa îți trimite un coleg un brand sau îl duci tu pe o a doua instalare, fără cont și fără cloud. [Lucrul cu parteneri](/info/partners.html) acoperă ce altceva să trimiți când persoana care primește brandul tău lucrează pentru altă organizație. Ca să imporți un brand din linia de comandă, vezi [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** împachetează fonturile pe care le-ai adăugat într-un RPM instalabil. Dacă ai încărcat tu vreunul dintre ele, Lolly îți cere mai întâi să confirmi că ai dreptul să le redistribui.

### Restaurează setări anterioare

Deschide **More** din bară, alege **Restore brand settings**, selectează un punct de restaurare datat și apasă **Restore**. Aceasta restaurează culorile, setările tipografice și alte tokenuri pentru brandul activ; fișierele de font și imagine rămân așa cum sunt. Lolly salvează mai întâi setările curente ca **Before restore**, ca să poți anula o restaurare chiar și după închiderea browserului. Cele mai recente 20 de puncte de restaurare sunt păstrate pe acest dispozitiv. O editare făcută în timp ce studioul arată **Saving…** rezistă unei reîncărcări, iar un card oferă restaurarea schimbărilor a căror salvare nu s-a încheiat.

### Versiuni

O versiune publicată este o **copie permanentă, cu nume**, păstrată pe acest dispozitiv. Nu se schimbă niciodată, așa că un instrument sau un link care o fixează (cu `designv`) continuă să deseneze același lucru. Un sistem cu ceva propriu listează **Versions & publishing** în meniul **More** al barei; după prima publicare, **Versions** se adaugă secțiunilor. `#/start?area=versions` deschide Versions.

::: warning O versiune publicată este permanentă
Nu există încă ștergere, iar panoul spune asta. Publicarea nu poate fi anulată; restaurarea poate. *Restore latest from this version* este o editare obișnuită, cu **Undo** oferit imediat.
:::

**Eliminările apar primele în cardul de compatibilitate**, pentru că un token eliminat strică un instrument.

**Publish only** păstrează o versiune fără să schimbe ce urmează instrumentele; **Publish and make active** face instrumentele și aplicația să urmeze acea versiune. **Follow the latest again** aplică imediat fiecare editare.

### Publică o pagină de brand

O [pagină de brand](/info/brand-page.html) este o singură adresă pentru oameni și agenți: o pagină cu logouri, culori, tipografie și exemple, cu aceleași informații în fișiere alături. **Publish a brand page**, sub Versions & publishing, arată pagina live și, lângă pagină:

- **Goes public**: fiecare fișier, grupat, cu dimensiunea lui.
- **Held back**: ce a rămas pe dinafară și de ce. Un logo fără licență înregistrată rămâne pe dinafară până când bifezi numele logoului. Un fișier de font are nevoie de o licență înregistrată care permite transmiterea mai departe, iar pagina arată un specimen convertit în contururi când fișierul rămâne pe dinafară. Skill-urile de brand interne nu apar niciodată.
- **What was checked**: perechi de culori pentru fiecare colourway și mod și regulile organizației. Acestea sunt măsurători, nu un verdict.
- **In your words**: o declarație de utilizare și un contact. Pagina afișează ce scrii, iar Lolly nu adaugă nicio licență sau afirmație juridică. Un comutator dezactivează rândul „Made with Lolly” din subsol.
- **On exports**: un comutator care [înregistrează adresa paginii în exporturile acestui sistem de design](/info/brand-page.html#lead-back-from-your-files). Comutatorul este oprit până când îl pornești, are nevoie de o adresă `https` și nu călătorește cu un pachet sau o copie. Un sistem de design blocat nu arată comutatorul, pentru că administratorul lui decide.

**Download folder** salvează dosarul ca ZIP, ca să-l găzduiești unde alegi. Nimic nu devine public până când găzduiești dosarul. Într-un terminal, `lolly system publish --out=<dir>` scrie același dosar. O instanță care servește pagini de brand oferă și **Publish to** la adresa ei: o singură apăsare explicită, prin lanțul de aprobare al instanței când are unul. Un sistem de design gestionat publică doar când administratorul lui permite.

### Conectează un agent

**Connect an agent**, în același loc, îți oferă text de lipit și spune ce poate face fiecare opțiune:

- **`AGENTS.md`** într-un proiect: agenții citesc numele și regulile sistemului. Nu desenează nimic și nu are nevoie de server.
- **Lolly's public server**: desenează cu Lolly Demo, indiferent de sistemul pe care îl ai deschis aici. Nu are nevoie de cheie.
- **Your instance**: desenează cu sistemele pe care le conține instanța și citește un token de serviciu dintr-o variabilă de mediu. Panoul oferă numele variabilei și nu arată niciodată un token.

Când niciun server găzduit nu desenează cu sistemul tău, panoul spune asta.

<!--i:eti-layers-->
## Gestionează sistemele tale de design

Deschide **Settings → Preferences → Design systems** ca să schimbi, să adaugi sau să elimini sisteme. **Open** selectează un sistem și îl deschide aici; **Make a new one** creează un sistem local și îl deschide cu câmpul numelui pregătit. Un singur sistem este activ la un moment dat, pentru întregul dispozitiv. [Arhitecturi de brand](/info/brand-architectures.html) te ajută să decizi când un brand are nevoie de propriul sistem de design.

**De unde provine un sistem.** Sistemul furnizat de catalogul unei implementări arată **Came with this app** sau **From this instance** într-o aplicație conectată la o instanță. Extinde **Catalogue source** ca să vezi cine îl furnizează, resursa lui de tokenuri și spațiul de nume și versiunea sau suma de control cunoscută; dacă o reîmprospătare eșuează, materialul din cache este etichetat.

**Sistemele gestionate sunt doar pentru citire.** Un sistem arată **Managed by this instance** (sau **Managed by this app** în aplicația desktop fără instanță) când catalogul lui blochează sistemul. Poți folosi și descărca un sistem gestionat. Deschiderea unuia aici arată o notă că este doar pentru citire, cu **Make an editable copy** și **Switch**, apoi rolurile lui de culoare și tokenurile, fără controale de editare. Sistemele tale locale rămân editabile, chiar și când cel gestionat a venit primul. O versiune cu un singur brand fix deschide Lolly Design System Setup la *This brand is set*, cu tokenurile brandului și regulile de utilizare de citit.

**Orice alt sistem furnizat îți aparține** și îl poți ascunde, edita și reseta, inclusiv Lolly Demo și Lolly Starter de pe lolly.tools. Editarea unuia îi păstrează numele și marchează rândul **Edited here**. **Reset to original** din meniul lui elimină schimbările făcute pe acest dispozitiv. Sistemul de pornire gol este excepția: prima schimbare acolo începe un sistem de design propriu, iar Lolly îi cere numele o singură dată. [Lolly Demo în uz](/info/lolly-demo-in-use.html#switch-to-your-own) arată ce înlocuiește sistemul tău propriu.

### Eliminarea unui sistem de design

Alege **Remove** din meniul unui sistem; confirmarea spune care sistem va fi activ după aceea. Sesiunile salvate, fișierele încărcate și materialul partajat cu alt sistem rămân.

Eliminarea unui sistem furnizat doar ascunde sistemul: resursele lui din catalog rămân, **Bring back** îl arată din nou și revine singur dacă elimini tot restul. Eliminarea unei copii importate sau editate nu elimină sistemul furnizat, logourile sau fonturile lui. Dacă acea copie era activă, sistemul furnizat devine din nou activ. Eliminarea unei copii găzduite active șterge doar conexiunea acelei copii; o instanță aleasă separat rămâne selectată.

::: details Schimbarea unui sistem de design furnizat de un server
Schimbarea a ceea ce furnizează un server este sarcina unui administrator: operatorul lui schimbă catalogul sursă și îl implementează din nou sau un administrator Lolly Work examinează și aplică o schimbare pe server. Editările de aici rămân locale, cu o singură excepție. Pe o instanță Lolly Work care îți acordă `brand.edit`, un sistem gestionat oferă și **Edit for** pentru acea instanță, care deschide o copie de editare. **Send to** pentru acea instanță din **Versions** trimite înapoi culorile, colourway-urile, rolurile de culoare și adresa paginii de brand. [Editează această instanță din studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) acoperă ce poate schimba o editare și cum servește instanța schimbarea. Vezi [Eliminarea unui sistem de design din catalog](/info/configuration.html#removing-a-catalogue-design-system) și [Configurare](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Folosește contextul de design în afara aplicației

**Download design context** salvează documentul de tokenuri, culorile rezolvate, familiile de fonturi declarate, id-urile resurselor, dovezile din surse acolo unde sunt înregistrate, acoperirea și regulile explicite, fără fișiere de font și fără dovadă de proprietate. Linia de comandă citește fișierul fără server: `lolly system import` îl face sistemul de design al terminalului, iar `lolly system check` verifică intrările Lolly Design față de contextul salvat. [Importă sistemul tău de design](/info/cli.html#bring-your-design-system) acoperă importul, iar [Ce sistem de design folosește o comandă](/info/cli-decks.html#which-design-system-a-command-uses) acoperă verificarea. Un client MCP citește același brief din `lolly://design-context` ([MCP Server](/info/mcp.html)).

<!--i:eti-map-pin-->
## Unde mergi mai departe

- **[Folosirea Lolly](/info/using.html)**: instrumentele, salvarea, partajarea și Assets.
- **[Arhitecturi de brand](/info/brand-architectures.html)**: cum se asociază diviziile, produsele, brandurile susținute, clienții și sezoanele cu sisteme de design, colourway-uri și identități de logo.
- **[Lucrul cu parteneri](/info/partners.html)**: partajarea brandului tău cu un partener și lucrul într-un brand pe care l-ai primit.
- **[Pagini de brand](/info/brand-page.html)**: publică sistemul tău de design la o singură adresă, ca un kit de presă și un kit pentru agenți.
- **[Design Tokens](/info/design-tokens.html)**: modelul de tokenuri în care este scris brandul tău.
- **[Exportă un fișier](/info/exporting.html)**: unități de tipar, CMYK și formatele în care se randează brandul tău.
