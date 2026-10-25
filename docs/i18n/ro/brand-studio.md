# Design System Setup

Logoul, culorile și fonturile tale aparțin unui singur loc, ca fiecare instrument, pagină și export să deseneze cu ele. Acel loc este **Design System Setup**, la `#/start`, iar sloganul lui spune pentru ce este: *Make it yours*.

Începe cu ce ai. Plasează un logo și Lolly îi citește culorile. Alege un font sau plasează fișierul de font licențiat de compania ta. Fiecare schimbare apare imediat în toată aplicația. Logoul, fonturile și tokenurile tale rămân pe acest dispozitiv. Alegerea unui Google Font este singurul pas care iese afară: Lolly întreabă mai întâi, apoi preia familia o dată.

Când arată bine, dă un nume sistemului de design și apasă **Export**. Primești un singur fișier `.lolly` de păstrat, de deschis pe alt dispozitiv sau de dat unui coleg. [Settings](/info/dashboard.html#design-system) arată sistemul activ doar pentru citire, iar coperta lui trimite înapoi aici pentru editare.

## Fă-l al tău în cinci minute

::: timeline
- <!--i:upload--> **Plasează logoul** pe zona de plasare din **Logos**. Lolly îi citește forma și culorile.
- <!--i:palette--> **Folosește aceste culori.** Culoarea principală a logoului devine primara ta, iar un neutru închis din logo devine culoarea textului.
- <!--i:font--> **Alege un font** în **Type**: un Google Font sau un fișier de font pe care îl deții.
- <!--i:pentool--> **Dă un nume sistemului.** Prima ta editare creează un sistem de design al tău, iar Lolly întreabă o dată numele.
- <!--i:download--> **Export** scrie întregul sistem ca un singur fișier `LollyBrand-….lolly`.
:::

Antetul arată ce sistem de design **Editing**, iar numele lui este un câmp pe care îl poți schimba oricând. Când prima ta editare întreabă **What is this design system called?**, cuvintele din logoul tău sunt completate dacă logoul le scrie. **Save name** păstrează numele; **Not now** păstrează un înlocuitor până îl tastezi în antet. Numele etichetează sistemul în Settings și la comutare și devine numele fișierului pe care îl scrie **Export**.

## Camerele

Studioul este un set de camere într-o bară pe margine, fără ordine fixă: nimic nu este numerotat și nimic nu așteaptă altceva. Pe telefon, bara devine o bandă de chip-uri sub antet.

![Bara de camere a studioului: Overview, Colours, Type, Logos, Tokens, Files și Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Cameră | Ce faci acolo | Cheie de link |
|---|---|---|
| **Overview** | Vezi ce conține sistemul, cu o ușă spre fiecare cameră | `overview` |
| **Colours** | Adaugi culori, le dai roluri, construiești nuanțe și o paletă | `color` |
| **Type** | Alegi cele patru fonturi pe care le citesc aplicația, instrumentele și fiecare export | `type` |
| **Logos** | Plasezi mărcile în fiecare orientare și tratament | `logos` |
| **Tokens** | Colțuri, spațiere, umbre și orice altă valoare cu nume | `tokens` |
| **Files** | Imaginile, audio și fișierele de mișcare pe care le păstrează brandul tău | `catalogue` |
| **Usage & rules** | Regulile pe care le aplică brandul tău, verificate pe exemple reale | `usage` |

Fă link la o cameră cu `#/start?area=<key>`. Camera Files păstrează cheia `catalogue`, pentru că o cheie de cameră este un contract permanent, iar `?tab=` funcționează în continuare ca alias mai vechi. O cheie necunoscută deschide Overview.

**Baza barei** conține acțiunile pentru întregul sistem, nu pentru o cameră. **Add from…** aduce un brand ([Adu un brand](#bring-a-brand-in)), iar **Tray** conține ce a găsit o scanare și nu ai adăugat încă. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** și **Restore brand settings** păstrează și mută sistemul ([Păstrează și mută sistemul tău de design](#keep-and-move-your-design-system)). Fiecare apare odată ce are ceva asupra căruia să acționeze.

## Overview

Fără nimic ales încă, Overview oferă patru moduri de a începe. **Start from a reference** deschide selectorul de surse pentru un logo, o captură de ecran, o pagină web sau un fișier de design, iar **Pick a colour**, **Choose a face** și **Add a logo** deschid direct acele controale. Deschiderea unuia nu scrie nimic, iar **Explore the tools** este acolo de la început.

Odată ce ceva este al tău, Overview arată ce ai, cu numerele tale în frunte. Colours dă numărul de culori, cu un `· N starter` estompat unde apar culori moștenite; banda lui pune mai întâi culorile tale, apoi o linie fină, apoi cele starter estompate. Type se citește pe roluri (*Inter for headings*, cu *Starter for the rest* pe linia de dedesubt). Logos spune câte sloturi sunt umplute (sau **Not set**), Tokens arată raza colțurilor, iar Files spune **Nothing yet** cât biblioteca este goală. Fiecare bloc își deschide camera.

### Starter și al tău

**Starter** este cuvântul pentru tot ce a venit cu aplicația, nu a fost ales. O instalare nouă nu poartă nicio culoare, doar o rampă neutră de la cerneală la hârtie, ca suprafețele, textul și liniile fine să poată fi randate înainte ca cineva să decidă ceva. Același cuvânt marchează materialul moștenit în fiecare cameră.

::: cols
## Starter

- A venit cu aplicația: neutrele de la cerneală la hârtie, fonturile starter, raza implicită a colțurilor.
- Estompat, cu o etichetă **Starter** și fără nuanță.
- Nu este numărat printre culorile tale. Neutrele trăiesc în **Tokens** ca **Neutrals · starter · 9**, iar **Open** le arată în Colours ca un grup pliat (`#/start?area=color&group=neutral`).
- Un rol bazat pe o culoare starter scrie *„Starter Paper stands in”*, cu **Choose…** pe selectorul lui.

## Al tău

- Ales sau instalat de tine.
- La intensitate deplină și un card nuanțat unde ai instalat un font.
- Numărat în Overview și în Tokens.
- Un rol care urmează altul scrie **↳ follows Primary**, nu repetă numele primarei.
:::

Materialul moștenit nu este niciodată desenat cu o margine întreruptă, pentru că aici o margine întreruptă înseamnă o țintă de plasare.

## Logos

Golește dosarul cu mărci în zona de plasare de sus: **„Drop marks here, or choose several at once”** primește câte fișiere ai. Fiecare fișier este citit pentru formă și cerneală, apoi așteaptă sub **Waiting for a slot** ca un chip care spune cum arată, precum *„Looks like the Horizontal primary”*, cu măsurătoarea folosită și un buton **Place** (**Replace** unde slotul este umplut). Unde nu este sigur, chip-ul spune asta și oferă **Change slot**, listând toate cele opt. Nimic nu este plasat până nu apeși ceva.

O marcă cu margine goală în exces primește mai întâi o ofertă de tăiere; răspunde-i sau apasă Escape și originalul intră neatins. Unde o marcă poate umple un slot vecin gol, camera oferă versiunea derivată **mono** sau **reverse** ca un chip marcat *Generated*.

Fiecare marcă ajunge într-o grilă de opt sloturi opționale, câte unul pe **orientare** și **tratament**:

- **Orientări:** Horizontal (wordmark și simbol pe un rând) și Vertical (stivuite, pentru spații pătrate și înalte).
- **Tratamente:** Primary, Primary reverse (pentru fundaluri închise), Mono (o culoare) și Mono reverse.

Un grup fără mărci încă se pliază la o linie; deschide-l ca să vezi sloturile lui. Fă clic pe un slot ca să adaugi un PNG, SVG, JPEG sau WebP sau fă clic pe un slot umplut ca să înlocuiești marca. Totul rămâne pe acest dispozitiv.

![Sloturile de logo cu Horizontal și Vertical deschise: fiecare tratament este un slot separat, iar fiecare slot este opțional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Mărci personalizate** sunt mărci pe care brandul tău le numește cu numele lui, precum o pictogramă, o stemă sau un favicon.
- **Mai multe identități.** Un sub-brand, produs sau eveniment poate avea propriul set complet: **+ Add another logo** și dă un nume setului. Setul tău principal este „Your logo”. [Arhitecturi de brand](/info/brand-architectures.html) arată când o identitate de logo este blocul potrivit.
- **Lolly citește culorile logoului.** Un card sub zona de plasare, și din nou sus în Colours, listează culorile logoului și întreabă **Which is the main colour?**, cu cea mai puternică culoare deja selectată (niciodată albul pe care a fost exportat). **Use these colours** le adaugă în paleta ta, face din culoarea principală primara ta și, când logoul are un neutru închis care se citește pe hârtie, îl face culoarea textului. **Not now** le lasă în Tray. La o instalare nouă, răspunsul cel mai probabil este aplicat imediat, iar cardul oferă **Undo** sau altă culoare principală. Un SVG dă culori exacte; un PNG, JPEG sau WebP dă culorile care acoperă o parte reală din marcă.

## Colours

Camera crește odată cu sistemul de design: o primă vizită este o singură decizie, iar restul sosește pe măsură ce crește paleta.

### Prima culoare

Un sistem fără culori proprii se deschide pe un chip mare și un câmp, cu o linie care spune că rolurile, nuanțele și setările de tipar sosesc pe măsură ce sistemul crește.

- **Chip-ul este selectorul.** Apasă **Pick a colour** și se deschide cardul OKLCH al studioului, completat cu ce conține câmpul: un nume, roata, cele patru cadrane, alfa și **Stored as**, cu **Cancel** și **Add colour** jos. Nimic nu ajunge în sistem până nu apeși **Add colour**.
- **Câmpul acceptă orice notație**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` sau un nume de culoare. Lipește o listă și devine un rând de chip-uri de adăugat pe rând sau cu **Add all**.
- **Încă două căi de intrare.** **Pick a colour from the screen** folosește pipeta unde browserul are una, iar **Take colours from an image** citește o captură de ecran sau o fotografie de pe acest dispozitiv.
- **Add nu este niciodată dezactivat.** Cu câmpul gol, deschide selectorul; un text pe care nu îl poate citi primește sub câmp o linie care spune asta.

Prima ta culoare devine **primara**, iar un chip o confirmă, precum *„Primary is now Vivid Violet”*, cu **Fine-tune** pentru a ajusta culoarea.


### Pe măsură ce paleta crește

Culorile tale stau lângă o previzualizare **In context** pe un ecran lat și deasupra ei pe unul mai mic. Previzualizarea arată un afiș, o diagramă sau un card de interfață în paleta ta. Culorile starter rămân în propriul grup pliabil.

![Camera Colours pe Lolly Demo: paleta în grupuri pliabile, fiecare culoare cu numele și hex-ul ei, și pastila de descărcare la bază](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Camera Colours după adăugarea unei culori, cu paleta ei și o previzualizare live a compoziției](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roluri: ce citesc instrumentele

**Roles** spun ce culoare joacă fiecare parte în fiecare instrument și export. Sunt opționale (trei culori libere și niciun rol este un sistem perfect bun), orice culoare poate primi unul, iar citirea contrastului este măsurată față de suprafață, mai întâi APCA. Fiecare rând de rol arată o culoare proprie la intensitate deplină, o culoare starter care ține locul sau **↳ follows Primary**.

Odată ce paleta are nuanțe, banda arată toate cele șapte roluri pe care le poate citi un instrument: Primary, Secondary, Surface, Text, Muted, Edge și On primary. On primary este derivat din primară, scrie **Derived** și nu are selector.

Accentul propriu al aplicației urmează implicit sistemul de design. Aceasta este setarea **Interface follows the design system** din **Settings → Appearance**; oprirea ei lasă interfața aplicației neutră, în timp ce instrumentele, canvasurile și exporturile urmează sistemul de design în ambele cazuri.

**Colourway-uri.** Un sistem de design poate conține mai multe culori principale, alese pe piesă. Lolly păstrează fiecare colourway, dar această cameră nu poate crea încă unul: un colourway este scris în fișierul de tokenuri. Într-un sistem cu colourway-uri, fiecare colourway are nevoie de propria primară și secundară și de propria suprafață când colourway-urile nuanțează fundalul, deci acele roluri rămân setate în editorul de mostre. [Lolly Demo în uz](/info/lolly-demo-in-use.html#colourways-on-real-work) arată colourway-uri pe muncă reală, iar [Adaugă colourway-uri unui sistem de design](/info/colourways.html#add-colourways-to-a-design-system) are formatul.

### Găsește mai multe culori

Trei instrumente se sprijină pe primara ta. Primele două doar sugerează, iar al treilea înlocuiește paleta după ce revizuiești schimbarea.

::: cols
## Explore shades & harmonies

Alege un **Starting colour**, o **Scheme** (Mono, Complement, Analogous sau Triad) și câte **Shades** (de la 3 la 20, implicit 5). **Fine-tune** setează intensitatea interfeței, contrastul și textul pe brand. Fă clic pe o nuanță ca s-o adaugi sau **Add 5 shades** pentru un grup. Culorile și rolurile tale rămân.

## Find matching colours

Alege o **Harmony**: Complementary, Adjacent, Triad, Tetrad sau Analogous (cu **Accents** de la 2 la 5 și un **Angle** de la 10° la 45°). Fiecare candidat are un nume generat și **+ Add**, o apăsare pe culoare.

## Rebuild the whole palette

Înlocuiește paleta pornind de la o culoare de start, după o revizuire a ce se schimbă și ce rămâne. Un checkpoint este luat mai întâi, iar **Undo** este oferit după aceea.
:::

Toate trei folosesc aceeași matematică perceptuală a culorii (OKLCH) ca motorul. În **Explore shades & harmonies**, rândurile **Primary**, **Neutral** și **Secondary** arată nuanțele sugerate, iar **Theme preview** arată exemple deschise și închise cu citirile lor de contrast.

![Trei grupuri de nuanțe sugerate, cu comenzi individuale de adăugare și un Theme preview separat](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Accente generate, fiecare cu un eșantion, un nume generat automat, codul hex și un buton Adaugă](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confirmarea unei palete generate

Deschide **Rebuild the whole palette…** și apasă **Preview full rebuild**. Revizuirea numără câte roluri rămân cum le-ai atribuit, câte dintre culorile tale proprii sunt păstrate și câte curbe de nuanțe, blocări de tipar, nuanțe ascunse și opriri de gradient sunt re-ancorate sau păstrate. **Apply rebuilt palette** confirmă; **Cancel** nu schimbă nimic. Apoi cardul oferă **Undo** cu focus pe el, iar checkpoint-ul luat înainte de schimb restaurează întregul sistem.

Un sistem cu colourway-uri păstrează fiecare colourway printr-o reconstrucție. Colourway-ul canonic urmează noua culoare de start, iar fiecare alt colourway își păstrează propriile culori, numele, ordinea și setările. Revizuirea listează ce colourway urmează și care își păstrează culorile. Lolly nu reconstruiește un sistem care își codifică colourway-urile într-un mod pe care nu îl poate edita; cardul spune de ce și nimic nu se schimbă.

### Secțiunile pentru experți

Patru secțiuni pliate stau sub previzualizare și roluri. Fiecare se deschide direct cu `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), descrisă mai sus.
- **Shade curves** (`focus=curves`) remodelează o rampă punct cu punct, cu curbe separate de luminozitate, croma și nuanță (L / C / H), iar nuanțele se redesenează pe măsură ce tragi.
- **Contrast** (`focus=contrast`): **Contrast-lock** retonează o rampă pentru a atinge ținte APCA față de un fundal ales de tine, iar **Rotate hue** rotește întreaga rampă pe roată.
- **Print** (`focus=print`) setează ce devine primara la presă: valoarea ei automată, o construcție CMYK fixată sau o cerneală spot cu nume.

### Paleta și fiecare mostră

Paleta listează culorile tale în grupuri pliabile, fiecare cu propriul **+ Add**. Creează și redenumește grupuri după plac. Un rol nu face niciodată o a doua tilă: o tilă către care indică un rol poartă în schimb o mică marcă (**P**, **S**, **Su**, **T**). **Colour chart** sub tile arată aceleași culori pe **Wheel** OKLCH (trage un punct ca să recolorezi, fă clic pe spațiu gol ca să adaugi o mostră) și pe diagrama **Gamut**, care arată unde se termină gama afișabilă. `#/start?area=color&focus=chart` deschide direct diagrama.

![Panoul paletei, fiecare grup putând fi restrâns, cu pastila de descărcare fixată la marginea de jos](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roata OKLCH - unghiul este nuanța, distanța spre exterior este saturația, iar gri-urile urmează o bandă de luminozitate pe lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Fă clic pe o mostră ca să-i deschizi editorul:

- **Rename** mostra.
- **Setează culoarea** pe glisoare OKLCH sau în **Hex**, **HSL**, **RGB** sau **CMYK**. Câmpul de valoare citește și scrie în spațiul activ. CMYK aici setează culoarea de ecran prin conversie; pentru a fixa cerneluri exacte, folosește **Print substitutes**.
- **Stored as** alege cum este salvată mostra: **LCH** (implicit, perceptual și gamă largă), Hex, RGB sau HSL.
- **Use as** dă mostrei direct un rol. Apasă din nou un rol evidențiat ca să-l ștergi.
- **Print substitutes** (pliat): blochează **CMYK** de la **Auto** la valori exacte de cerneală sau setează o **Spot colour** cu un **Name** (precum `PANTONE 186 C`), un **Book** opțional și un **Finish** pentru folie, embosare, debosare, lac selectiv, soft touch sau tăiere, falț ori perforație. O presă folosește aceste blocări când exporți un PDF sau TIFF CMYK; vezi [Profiluri de culoare](/info/exporting.html#colour-profiles).
- **In other spaces** (pliat): o valoare pe spațiu de culoare, derivată sau creată de tine, iar cea creată de tine câștigă la export.

**Ștergerea unei mostre** este sigură. Nuanțele derivate și rolurile de temă sunt ascunse, deci nimic care le citește nu se strică, în timp ce culorile adăugate de tine sunt eliminate.

::: details Lucrul cu multe mostre
Fiecare mostră are un mâner de tragere. Trage ca să reordonezi în grup sau pune focus pe mâner, apasă Space, folosește tastele săgeți și apasă din nou Space ca să plasezi; Escape anulează. Ca să muți culori între grupuri, folosește controlul **Group** al editorului sau selectează mai multe și folosește **Move to**.

Selecția nu are nevoie de un mod. Bara apare cu prima tilă selectată și dispare cu ultima.

- **Trage pe spațiu gol** ca să desenezi un dreptunghi; fiecare tilă atinsă intră în selecție, între grupuri. O secțiune pliată nu adaugă nimic.
- **Shift-clic** ia un interval în ordinea de citire, **Cmd/Ctrl-clic** comută o tilă, iar un clic simplu deschide editorul.
- Fiecare antet de grup are **Select all**, iar **Cmd-A** cu o tilă în focus ia fiecare culoare pe care o deții, niciodată una starter.
- Grila are o singură oprire de tab: săgețile mută, Shift-săgețile extind, Space comută, Delete elimină, iar Escape șterge. Ca să ajustezi un canal, apasă mai întâi `l`, `c` sau `h`.
- Pe un ecran tactil, apasă lung o tilă ca să începi o selecție, apoi atinge ca să adaugi.

Bara scrie **{n} selected**, apoi **Move to**, **Give a role** (fiecare culoare primește pe rând următorul rol), **Download** (selecția în oricare dintre cele șase formate de paletă), **Duplicate** (o copie a fiecăreia, plasată după original), **Copy values** și **Delete**. O copie se deschide direct în editor; mai multe rămân selectate. Un Cmd/Ctrl-Z anulează o întreagă acțiune în masă.
:::

### Degradeuri

Panoul opțional **Gradients** construiește tokenuri de amestec din paletă. Fiecare gradient are o previzualizare, 2 până la 8 opriri cu nume și un unghi. O oprire indică o mostră, deci recolorează mostra și gradientul o urmează. Amestecurile rulează în OKLCH.

Descărcările paletei (design tokens, CSS, SCSS, GIMP și Adobe Swatch Exchange) stau într-o pastilă la baza paletei odată ce există nuanțe. [Ia-ți paleta și fonturile oriunde](/info/using.html#take-your-palette-and-fonts-anywhere) descrie fiecare format.

## Tipografie

Fără un font propriu, camera este un singur card: **Primary**, setat la dimensiune de citire în fontul care îl servește astăzi, cu o etichetă **Starter**, un buton **Choose a face** și linia *„Nothing installs until you choose one.”* Headings, code și italic urmează primarul până le alegi; **Choose them separately** arată cardurile lor.

![Camera Type fără niciun font ales încă - un card la mărime de citire, o etichetă Starter pe el și un buton plin Alege un font](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Alege un font și camera se deschide în patru carduri de rol, lista Fonts și un specimen live:

- **Primary**: textul de corp, butoanele și fiecare instrument.
- **Headings**: fontul de afișare pentru `h1` și `h2`.
- **Code**: un font monospațiat pentru cod și date.
- **Italic**: un italic adevărat pentru accent, citate și paranteze.

Un card este nuanțat doar unde ai instalat acel font, iar butonul lui scrie **Change** pe un font al tău și **Choose a face** peste tot în rest. Nimic de pe un card nu confirmă nimic: butonul deschide scena de comparare pentru acel rol.

![Cele patru carduri de rol dezvăluite - fiecare setat în fontul care îl servește, cu o etichetă Starter acolo unde nimeni nu a ales unul și Italic urmând principalul](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Scena de comparație

Scena se deschide în cameră, sub cardul pe care l-ai apăsat, iar cardurile se pliază la o bandă de o linie, ca scena să apară pe primul ecran al unui telefon. Escape anulează și readuce focusul pe card.

1. Apasă **Choose a face** pe card.
2. Tastează un nume de familie și apasă **Preview** sau apasă una dintre cele șase familii **Pinned** de sub câmp.
3. Apasă **Use this face**.

![Scena de comparație deschisă sub cardul ei, cu rândul de căutare, familiile fixate și cardurile pliate într-o bandă pe un rând](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Consimțământul se cere o dată.** Prima dată când o previzualizare ajunge la Google Fonts, un dialog explică: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** merge mai departe și este reținut. **Cancel** lasă cardul scriind *„Not fetched. Nothing was sent to Google.”*, cu propriul **Fetch from Google**.

**Plasează un fișier de font pe scenă** (TTF, OTF sau WOFF) ca să previzualizezi un font licențiat pe care îl deții deja. În ambele cazuri fontul rămâne pe acest dispozitiv, se randează offline în aplicație, în instrumente și în fiecare export și călătorește în fișierul sistemului de design. Tot ce este pe Google Fonts vine sub o licență deschisă (OFL, Apache sau UFL).

### Fonts on this device

Panoul **Fonts** listează fiecare font de pe acest dispozitiv și rolul pe care îl servește. Fonturile adăugate de tine conduc sub **In the design system**, fiecare cu rolurile ei și o ștergere. Fonturile starter urmează într-un rând estompat și pliat. **Add a face** deschide scena de comparare pentru orice rol. Panoul **Type roles** arată un specimen live al fiecărui rol cu familia și starea lui, precum *Inter* sau *Inter · follows Primary*.

## Tokenuri

Tokenurile sunt valorile cu nume din spatele sistemului de design: culori, fonturi, logouri, colțuri și spațiere. Instrumentele le citesc după nume, deci o schimbare de aici ajunge la fiecare instrument deodată.

![Camera Tokens: antetul cu un exemplu din sistem și acțiunile de fișier, tile care numără fiecare fel de token, apoi perechile de culori cu citirile lor de contrast](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Antetul** dă un exemplu din propriul sistem (*Primary is Spearmint, #033633*) și acțiunile de fișier: **Download** (întregul sistem ca design tokens sau paleta în alte cinci formate), **Copy CSS** și **Add from…** pentru a citi înapoi un fișier JSON.
- **Tilele** numără fiecare fel de token și sar la secțiunea lui: Colours, Type, Logos, Shape and spacing, More și All tokens. Numără ce este al tău, ca Overview. Pe telefon, tilele derulează lateral.
- **Colours** începe cu perechile pe care instrumentele le pun împreună (text pe suprafață, pe primară, estompat pe suprafață) cu o citire APCA în deschis și închis și semnalează **Weak contrast** unde o pereche nu ajunge. Apoi fiecare grup de culori: o rampă ca un rând de chip-uri, alte culori cu valoarea lor și referința pe care o folosesc instrumentele, precum `{color.brand.spearmint}`. Apasă o referință ca s-o copiezi. **Edit in Colours** deschide un grup în camera Colours.
- **Type** și **Logos** listează fontul pentru fiecare rol și fiecare slot de logo, cu **Edit in Type** și **Edit in Logos** odată ce ai ale tale.
- **Shape and spacing** conține **Rounded corners** (`shape.radius`) și **Spacing rhythm** (`space.base`). Fiecare scrie *Lolly default* până miști glisorul și *Yours* după aceea, se salvează imediat și poate fi anulat.
- **More tokens** adaugă spațiere, dimensionare, grosimea conturului, opacitate, rotire, numere simple și umbre, stocate ca [design tokens](/info/design-tokens.html) standard.
- **App appearance (advanced)** listează culorile, dimensiunile și umbrele pe care le folosesc ecranele proprii ale Lolly, iar **Inspect every token (advanced)** caută și editează orice valoare stocată, arătând mai întâi fiecare schimbare spre revizuire.

O secțiune fără nimic în ea oferă calea de a umple golul: **Pick a colour**, **Choose a face** sau **Add a logo**.

## Fișiere

Plasează fișierele pe care le păstrează brandul tău, în afară de logouri: fișiere **vector**, **image**, **audio** și **motion** (video, Lottie și animații). Apar în [Assets](/info/using.html#assets-your-library), sortate pe secțiuni și gata în selectorul de resurse al fiecărui instrument, și rămân pe acest dispozitiv.

## Usage & rules

**Usage & rules** pune alegerile brandului tău la treabă: ce pot schimba oamenii, ce rămâne fix și ce poate verifica Lolly.

![Usage & rules pe Lolly Demo: un card Brand rules gol cu Add your first rule, apoi Try your brand in use cu exemplele lui gata de randat](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** listează regulile tale. **Add rule** (sau **Add your first rule**) deschide un scurt formular:

- un **Rule name** în cuvintele tale, precum *Beacon accents*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** sau **Text length**, cu rolul de brand pe care îl folosește, sub propriul tău nume pentru rol;
- **Example** la care se aplică (Poster, Title slide, Content slide sau Chart), **Mode** și dacă este **Required** sau **Advisory**;
- **Reviewed by**, apoi **Save draft** sau **Approve & save**.

Aprobarea înregistrează propria ta decizie pe acest dispozitiv. Regulile obligatorii aprobate constrâng afișul reutilizabil, iar verificările acoperă doar PNG-urile exemplu; nu schimbă niciun alt instrument.

Regulile pe care un sistem de design le aduce în fișierul său de tokenuri, precum perechile de culori aprobate, greutatea și alinierea textului sau un logo pe suprafață, sunt listate aici ca **Checked in Design**. Design le verifică strat cu strat în cardul **Before you export** din panoul de export, iar `lolly check` face la fel pentru un document Design salvat ([Înainte să exporți](/info/design.html#before-you-export)). O regulă pentru care această versiune nu are verificator este păstrată cum a fost furnizată și marcată **Unchecked**.

**Try your brand in use** randează patru exemple din revizia curentă cu **Render & check examples**. Alege un **Brand mode** și **Try your own text** pentru titlu, textul de sprijin și textul diapozitivului. Fiecare exemplu raportează ce s-a măsurat, cu **See checks & sources** și **Download check report**, iar **Make reusable poster** descarcă un `.lolly` al cărui layout fix și ale cărui alegeri de intrare aprobate călătoresc cu fișierul. Exemplele sunt locale: nimic nu este publicat sau aprobat prin rularea unei verificări.

Un build care vine cu un brand fix arată aceleași reguli și exemple doar pentru citire, sub *This brand is set*.

## Adu un brand

**Add from…** la baza barei deschide un selector care întreabă ce ai, nu ce format este:

- **Design tokens or a design file**: JSON DTCG sau Tokens Studio, un proiect Penpot, un zip de seturi de tokenuri, un pachet de sistem de design Lolly sau un SVG.
- **PDF**: un deck sau un fișier de ghiduri, citit pe acest dispozitiv pentru culori, mărci și fonturile încorporate.
- **Logo or screenshot**: o imagine devine o paletă sugerată, citită pe acest dispozitiv. Citește culori, nu fontul sau layoutul.
- **Saved web page**: un fișier HTML și fișierele lui CSS sau HTML ori CSS lipit, până la 20 de fișiere și 2 MB. Se citește doar textul furnizat: resursele legate nu sunt preluate, iar scripturile nu rulează.
- **Font file**: TTF, OTF sau WOFF. Deschide camera Type, unde se instalează fontul.
- **Website**: o pagină, citită pentru culori și font. Această tilă apare doar pe un dispozitiv care poate citi o pagină și spune ce cititor folosește: aplicația de pe acest dispozitiv sau extensia de browser într-o filă în fundal, autentificată ca tine. Numirea unui URL doar completează câmpul; apăsarea preluării este consimțământul.

Alege sursa fișier de design, iar următorul card listează formatele acceptate ca tile cu pictogramă, cu tot cardul ca țintă de plasare. Poți plasa un fișier și direct pe studio.

![Cardul de import - formatele acceptate conduc ca file cu iconițe, iar întregul card este o singură zonă de plasare](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Un **pachet de sistem de design Lolly** (`.lolly` sau un `.zip` mai vechi) se instalează într-un singur pas.
- Un export **Penpot** (`.penpot`) aduce tokenurile sale de design.
- Un fișier **Design Tokens** (W3C DTCG) sau **Tokens Studio** (`.json`) aduce tokenurile sale.
- Un **SVG simplu** este scanat pentru culorile din care alegi, prima devenind primara ta.

### Revizuiește o referință

Un logo, o captură de ecran, un site web sau o pagină salvată deschide **Try these colours**: un exemplu în culorile propuse, o **Main colour** pe care o poți schimba și un nume pentru un sistem nou. O casetă spune ce face aplicarea: **înlocuiește** setările de tokenuri active cu paleta generată și stilurile implicite, **păstrează** fonturile și fișierele din bibliotecă, iar sistemul anterior poate fi **recuperat**. **Apply suggested settings** aplică paletele deschisă și închisă, după un checkpoint, iar **Restore brand settings** poate readuce vechile setări. **Change reference** alege altă sursă.

**Palette, source details and individual choices** arată ce s-a citit, orice nume de fonturi găsite și contrastul previzualizării. Numele fonturilor sunt doar sugestii; Type rămâne locul unde instalezi un font. Detaliile sursei pot include tipografie, goluri, padding și valori de colț unde au fost observate, etichetate **Not observed** în caz contrar. O pagină salvată sau o citire nativă de site raportează stiluri declarate, pe care pagina poate să nu le folosească, iar extensia de browser poate raporta stiluri măsurate dintr-un eșantion de elemente vizibile. Acestea sunt observații: nimic nu este instalat, iar spațierea sursei nu o înlocuiește niciodată pe a ta. **Choose individual items in the tray** păstrează elemente individuale, iar **Download design context** salvează un raport JSON cu observații, tokenuri propuse și informații despre sursă (cu un SHA-256 al oricărui HTML sau CSS furnizat). Raportul nu conține text brut de pagină și nu este un Content Credential semnat.

Importurile PDF și de fișiere de design își păstrează propriile controale de revizuire. Elementele din **Tray** nu schimbă nimic până nu le adaugi în camera care deține acel fel de material. `#/start?source=<kind>` deschide selectorul pe o sursă (`file`, `pdf`, `image`, `font`, `url`, `page`), iar `?import` deschide lista simplă.

### Găsește și compară un aspect

Deschide **Find a look** din Overview sau din lista de sisteme de design din Settings. Răsfoiește sistemele salvate pe acest dispozitiv și câteva exemple Lolly reutilizabile și caută după nume, etichetă de culoare sau font declarat. **Closest to my current palette** sortează după similaritatea măsurată a culorii, iar fonturile potrivite departajează egalitățile; nu este un scor de calitate.

Selectează un aspect ca să-l revizuiești sau două ca să le compari alăturat. Selectarea nu schimbă nimic. **Use this saved system** comută la el, iar **Use these colours** aplică culorile unui exemplu prin checkpoint-ul obișnuit, păstrându-ți fonturile. **Restore brand settings** recuperează aspectul anterior. Sistemele salvate au **Search tags** editabile sub **Details and design context**. Exemplele sunt rețete originale de culoare Lolly, fără colecție extrasă și fără cont.

![Compară Sunroom și Orchard unul lângă altul înainte de a aplica oricare dintre sistemele de culoare.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Păstrează și mută sistemul tău de design

### Mută un brand între dispozitive

**Export** scrie un singur fișier **`LollyBrand-….lolly`**: tokenurile, fonturile, logourile și preferința de temă, cu un manifest de integritate verificat la reintrare. Versiunile web dinainte de 1.0.7 numeau același fișier `.zip`, iar acea scriere este tot acceptată. **Tokens (.json)** scrie singur documentul simplu de design tokens, fără fonturi sau logouri, pentru un depozit, un pas de build sau alt instrument de tokenuri.

Ca să aduci unul înapoi, folosește **Add from… → Design tokens or a design file** sau plasează fișierul pe studio. Așa îți dă un coleg un brand sau așa duci unul pe o a doua instalare, fără cont și fără cloud. Ca să aduci un brand din linia de comandă, vezi [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** împachetează fonturile adăugate într-un RPM instalabil. Dacă ai încărcat singur vreunul dintre ele, Lolly îți cere mai întâi să confirmi că ai dreptul să le redistribui.

### Restaurează setări anterioare

Alege **Restore brand settings**, selectează un checkpoint datat și apasă **Restore**. Restaurează culorile, setările de font și alte tokenuri pentru brandul activ; fișierele de font și de imagine rămân cum sunt. Lolly îți salvează mai întâi setările curente ca **Before restore**, deci poți inversa o restaurare chiar și după închiderea browserului. Ultimele 20 de checkpoint-uri sunt păstrate pe acest dispozitiv.

### Versions

O versiune publicată este o **copie permanentă, cu nume**, păstrată pe acest dispozitiv. Nu se schimbă niciodată, deci un instrument sau un link care o fixează (cu `designv`) continuă să deseneze același lucru. Un sistem cu ceva al tău arată un discret link **Versions & publishing** la baza barei; după prima publicare devine intrarea **Versions**. `#/start?area=versions` o deschide direct.

- **O versiune este permanentă.** Nu există încă ștergere, iar panoul spune asta.
- **Eliminările conduc cardul de compatibilitate**, pentru că un token eliminat este ce strică un instrument.
- **Publicarea nu poate fi anulată; restaurarea poate.** *Restore latest from this version* este o editare obișnuită, cu **Undo** oferit imediat.

**Publish only** păstrează o versiune fără a schimba ce urmează instrumentele; **Publish and make active** face ca instrumentele și aplicația să urmeze acea versiune. **Follow the latest again** pune fiecare editare live în clipa în care o faci.

## Administrează sistemele tale de design

Deschide **Settings → Preferences → Design systems** ca să comuți, adaugi sau elimini sisteme. **Open** selectează un sistem și îl deschide aici; **Make a new one** creează un sistem local și îl deschide cu câmpul de nume gata. Un sistem este activ la un moment dat, pentru tot dispozitivul. [Arhitecturi de brand](/info/brand-architectures.html) ajută să decizi când un brand are nevoie de propriul sistem de design.

**De unde vine un sistem.** Sistemul furnizat de catalogul unei instalări scrie **Came with this app** sau **From this instance** într-o aplicație conectată la una. Extinde **Catalogue source** ca să vezi cine îl furnizează, resursa lui de tokenuri și spațiul de nume și versiunea sau suma de control cunoscută; dacă o reîmprospătare eșuează, materialul din cache este etichetat.

**Sistemele administrate sunt doar pentru citire.** Un sistem scrie **Managed by this instance** (sau **Managed by this app** în aplicația desktop fără instanță) când catalogul său îl blochează. Îl poți folosi și descărca, iar deschiderea lui aici arată o notă doar pentru citire cu **Make an editable copy** și **Switch**. Sistemele tale locale rămân editabile, chiar dacă cel administrat a venit primul. Un build cu un brand fix deschide Design System Setup pe *This brand is set*, cu tokenurile și regulile de utilizare ale brandului de citit.

**Orice alt sistem furnizat este al tău** de ascuns, editat și resetat, inclusiv Lolly Demo și Lolly Starter pe lolly.tools. Editarea unuia îi păstrează numele și marchează rândul **Edited here**, iar **Reset to original** din meniul lui renunță la schimbările făcute pe acest dispozitiv. Starter-ul gol este excepția: o primă schimbare acolo începe un sistem de design al tău, deci Lolly întreabă o dată cum să numească noul sistem. [Lolly Demo în uz](/info/lolly-demo-in-use.html#switch-to-your-own) arată ce înlocuiește sistemul tău.

### Eliminarea unui sistem de design

Alege **Remove** din meniul unui sistem; confirmarea spune ce sistem va fi activ după aceea. Sesiunile salvate, încărcările și materialul comun cu alt sistem rămân.

Eliminarea unui sistem furnizat doar îl ascunde: resursele lui din catalog rămân, **Bring back** îl arată din nou și revine singur dacă elimini tot restul. Eliminarea unei copii importate sau editate nu elimină sistemul furnizat, logourile sau fonturile lui, iar dacă copia era activă, sistemul furnizat devine din nou activ. Eliminarea unei copii găzduite active șterge doar conexiunea acelei copii; o instanță aleasă separat rămâne selectată.

Schimbarea a ce furnizează un server este o sarcină de administrator: operatorul lui schimbă catalogul sursă și reinstalează sau un administrator Lolly Work revizuiește și aplică o schimbare de server. Editările de aici rămân locale. Vezi [Eliminarea unui sistem de design din catalog](/info/configuration.html#removing-a-catalogue-design-system) și [Configurare](/info/configuration.html#supplied-and-local-design-systems).

## Folosește contextul de design în afara aplicației

**Download design context** salvează documentul de tokenuri, culorile rezolvate, familiile de fonturi declarate, id-urile de resurse, dovezile sursei unde au fost înregistrate, acoperirea și regulile explicite, fără fișiere de font și fără dovada proprietății. Linia de comandă citește fișierul fără server: `lolly system import` îl face sistemul de design al terminalului, iar `lolly system check` verifică intrările Design față de contextul salvat. [Adu-ți sistemul de design](/info/cli.html#bring-your-design-system) acoperă importul, [Ce sistem de design folosește o comandă](/info/cli-decks.html#which-design-system-a-command-uses) acoperă verificarea, iar un client MCP citește același brief din `lolly://design-context` ([Serverul MCP](/info/mcp.html)).

## Ce urmează

- **[Folosirea Lolly](/info/using.html)**: instrumentele, salvarea, partajarea și Assets.
- **[Arhitecturi de brand](/info/brand-architectures.html)**: cum se mapează diviziile, produsele, brandurile susținute, clienții și sezoanele pe sisteme de design, colourway-uri și identități de logo.
- **[Design Tokens](/info/design-tokens.html)**: modelul de tokenuri în care este scris brandul tău.
- **[Exportă un fișier](/info/exporting.html)**: unități de tipar, CMYK și formatele în care randează brandul tău.
