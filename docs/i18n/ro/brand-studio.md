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
- **Files** - fișierele imagine, audio și video pe care le păstrează brandul tău.

Pe telefon, aceeași listă devine o bandă orizontală de chip-uri fixată sub antet. Schimbarea camerei nu reîncarcă niciodată nimic - editorul păstrează toate panourile montate și pur și simplu afișează pe cel cerut.

**Trimite direct către o cameră** cu `#/start?area=<key>`. Cheile sunt `overview`, `color` *(observă ortografia americană din URL)*, `type`, `logos`, `tokens`, `catalogue` (camera Files - cheia panoului este un contract permanent, deci URL-ul păstrează numele vechi) și `versions`. `?tab=` este aliasul de multă vreme pentru același lucru și încă funcționează, deci linkurile vechi și marcajele continuă să funcționeze; orice nerecunoscut deschide Overview în loc să eșueze.

Fixate la **baza barei** sunt acțiunile care aparțin întregului sistem de design, nu unei singure camere:

- **Add from…** - selectorul de sursă, pentru a aduce un brand dintr-un fișier, un PDF, o imagine, un font sau un site web. Vezi [Bring a brand in](#bring-a-brand-in) mai jos.
- **Tray** - candidații pe care o scanare i-a găsit dar nu i-a confirmat încă. Rămâne ascuns până când o scanare păstrează efectiv ceva, și afișează un număr când o face; nimic din el nu îți schimbă brandul până apeși Add pe acel rând.
- **Export** - scrie întregul brand ca un singur `LollyBrand-…zip`.
- **Tokens (.json)** - documentul simplu de design tokens de sine stătător, pentru un repo, un pas de build sau o altă unealtă de tokeni.
- **Versions** - publică, activează și restaurează copii denumite ale sistemului de design. Ascuns până există ceva propriu de publicat (sau până un link `?area=versions` îl cere pe nume).

![Bara camerelor studioului - Overview, Colours, Type, Logos, Tokens și Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview este camera în care ajungi, și are două fețe.

Cu **nimic configurat încă** oferă două uși - **Start from a file** (design tokens, un proiect Penpot, un pachet de sistem de design sau un SVG) și **Start from scratch** (adaugă o culoare, apoi continuă oricând vrei) - și o ieșire discretă **Explore the tools** sub ele, pentru că a pleca este și el un răspuns legitim.

Odată ce un sistem de design există, aceeași cameră arată **ce ai**: paleta și numărul ei de culori, familiile de fonturi în vigoare, câte sloturi de logo sunt completate, câți tokeni există și camera Files. Fiecare bloc este o ușă spre camera lui. Aici sunt numere, niciodată o bară de progres și niciodată un card de finalizare - nimic în acest studio nu este datorat.

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
- **Încarcă un SVG și Lolly îi citește culorile.** La o instalare nouă, setează discret culoarea ta primară din logo și spune asta. La un brand existent, oferă în schimb culoarea ca sugestie - *"Found in the logo: #…"* cu un buton **Use as primary** lângă ea - în camera Colours, unde o poți accepta sau respinge.

## Colours

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Cea mai bogată cameră, în două panouri. Cel din stânga este unde lucrezi; cel din dreapta este **paleta ta live**. Trage delimitatorul dintre ele pentru a redimensiona (Enter pe el pliază paleta din cale).

![Camera Colours - o culoare primară derivă ramp-uri, carduri specimen cu rapoarte de contrast și o paletă live](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Adaugă o culoare, apoi dă-i un rol

**Add a colour** este întreaga cale simplă: lipește sau alege o culoare în orice notație și devine exact un token. Nimic nu este derivat din ea, nimic nu este sugerat în ea, nimic altceva nu este cerut. Lipește o *listă* întreagă de culori și fiecare devine un chip pe care îl poți adăuga separat.

**Roles** este stratul de deasupra - ce culoare joacă ce rol. Rolurile sunt opționale (un sistem de design cu trei culori independente și fără roluri este unul perfect valabil), orice mostră poate primi unul și citirea contrastului este măsurată față de suprafață, mai întâi APCA.

### Aripile pentru experți

Patru secțiuni pliate stau sub cele două de mai sus. Deschide-o pe cea pe care o vrei; fiecare poate fi accesată direct ca `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - o culoare într-un set complet de nuanțe. Descris mai jos.
- **Shade curves** (`focus=curves`) - remodelează un ramp punct cu punct. Luminozitatea, croma și nuanța primesc fiecare propria curbă, comutabile cu L / C / H, iar nuanțele de mai jos se recalculează live pe măsură ce tragi.
- **Contrast** (`focus=contrast`) - **Contrast-lock** reechilibrează un ramp pentru a atinge ținte APCA față de un fundal pe care îl alegi, fiecare pas păstrându-și propria nuanță și cromă; **Rotate hue** rotește întregul ramp în bloc pe roata cromatică, fiecare nuanță păstrându-și luminozitatea și croma.
- **Print** (`focus=print`) - ce devine culoarea primară la tipar: valoarea ei automată pentru ecran, sau o valoare CMYK fixată ori o cerneală spot denumită în schimb.

### O culoare, o paletă întreagă

În **Generate a starter palette**, alege o **Primary colour** și Lolly calculează o paletă completă - suprafețe deschise și întunecate, text, accente și ramp-uri complete de nuanțe deschise/închise - folosind aceeași matematică perceptuală a culorii (OKLCH) pe care motorul o folosește peste tot. Ajustează derivarea:

- **Scheme** - Mono, Complement, Analogous sau Triad - stabilește cum se raportează culoarea secundară la cea primară a ta.
- **Shades** - un cursor de la 3 la 20 (implicit 5) controlează câte trepte generează fiecare ramp.
- **Fine-tune** (pliat) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) și **Text on brand** (Auto / Light / Dark).

Nimic în această aripă nu scrie ceva în brandul tău. Este o previzualizare, live în toată aplicația, ca să o poți evalua, până când apeși **Replace palette** (mai jos).

Sub culoarea primară vei vedea ramp-urile live **Primary / Neutral / Secondary / Blend** și carduri specimen Light și Dark, fiecare purtând propria citire de contrast - raportul WCAG cu cifra APCA `Lc` lângă el. **Apasă o treaptă din ramp-ul Neutral sau Secondary** pentru a ancora acea nuanță în locul celei derivate implicit.

![Cele patru rampe suprapuse deasupra cardurilor demonstrative deschise și întunecate, fiecare card purtându-și propriul raport de contrast WCAG](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Creează-ți paleta (generator de armonii)

Tot în această aripă, **Creează-ți paleta** generează culori de accent asortate din culoarea ta primară. Alege o **Armonie** - **Complementară**, **Adiacentă**, **Triadă**, **Tetradă** sau **Analogă** (care aduce propriul număr de **Accente**, de la 2 la 5, și un **Unghi** de nuanță de la 10° la 45°) - iar fiecare candidat vine cu un nume generat automat, ușor de citit, și un buton **+ Adaugă**. Adăugarea uneia pune imediat acea culoare în paleta ta, o apăsare pentru un token. *„Paleta ta, aplicată”* previzualizează întregul set pe grafice reale.

![Accente generate, fiecare cu un eșantion, un nume generat automat, codul hex și un buton Adaugă](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confirmarea unei palete generate

**Înlocuiește paleta** este singurul control din această aripă care scrie ceva, și nu scrie niciodată imediat. Apasă-l și se deschide mai întâi un card de revizuire, intitulat „Înlocuiești paleta?”, care detaliază exact ce urmează să se întâmple: câte roluri rămân așa cum le-ai atribuit, câte culori adăugate de tine sunt păstrate, câte curbe de nuanțe sunt reancorate, câte blocaje de tipar sunt re-fixate, câte nuanțe ascunse rămân ascunse, câte capete de degrade își păstrează culoarea.

**Înlocuiește paleta** de pe acel card o confirmă; **Anulează** renunță și nu schimbă nimic. După ce a rulat, cardul devine „Paletă înlocuită.” cu un singur **Undo** deja focalizat - iar un punct de control al întregului sistem de design este creat *înainte* de schimbare, astfel încât „pune-l înapoi cum era” înseamnă o restaurare, nu o după-amiază pierdută.

### Paleta, graficul și fiecare eșantion

Panoul din dreapta listează fiecare culoare din brandul tău, grupată (Primary, Neutral, Secondary, Spectrum, Custom, Roles), fiecare grup putând fi restrâns, cu propriul **+ Add**. Dedesubt, **Colour chart** se deschide pe două vizualizări ale acelorași eșantioane: **Wheel** (roata OKLCH - trage un punct pentru a-i schimba culoarea, apasă un punct pentru a-l edita sau apasă un spațiu gol pentru a adăuga un eșantion nou) și graficul **Gamut**, care arată unde se termină de fapt intervalul afișabil. `#/start?area=color&focus=chart` deschide direct cardul, la fel ca `?wheel` dintotdeauna.

![Panoul paletei, fiecare grup putând fi restrâns, cu pastila de descărcare fixată la marginea de jos](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roata OKLCH - unghiul este nuanța, distanța spre exterior este saturația, iar gri-urile urmează o bandă de luminozitate pe lateral](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Degradeuri

Un panou opțional **Gradients** (Degradeuri) construiește tokenuri de amestec din paleta ta, pentru fundaluri și accente. Sari peste el complet dacă brandul tău nu folosește degradeuri. Fiecare degrade are o previzualizare, capete numite (2-8) și un unghi. Comportamentul-cheie: **un capăt face referire la un eșantion**, deci recolorează acel eșantion și degradeul îl urmează. Interpolarea rulează în OKLCH pentru amestecuri curate. Șterge un capăt pentru a scurta șirul.

### Ia paleta în altă parte

Pastila plutitoare fixată la marginea de jos a panoului paletei descarcă întreaga paletă ca **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, o paletă **GIMP (.gpl)** sau un **Adobe Swatch Exchange (.ase)** - astfel încât brandul intră direct în Illustrator, Figma, GIMP sau o foaie de stil. Stă în afara zonei derulabile a panoului, deci își păstrează locul indiferent cât de mult derulezi paleta. (Poți descărca paleta și din vizualizarea [Catalog](/info/using.html).)

## Tipografie

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Camera începe cu **patru carduri de rol** - cele patru fonturi pe care aplicația, uneltele tale și fiecare export chiar le citesc. Fiecare card arată ce servește acel rol chiar acum, setat în acel font, cu o linie de text real dedesubt:

- **Primary** (Principal) - text de bază, butoane și fiecare unealtă.
- **Headings** (Titluri) - fontul de afișare pentru `h1`/`h2`.
- **Code** (Cod) - un font monospațiat pentru cod și date.
- **Italic** - un adevărat însoțitor italic pentru accentuare, citate și paranteze.

Titlurile, codul și italicul revin implicit la fontul principal până le atribui, deci un brand cu un singur font nu are nicio decizie de luat aici. Nimic de pe un card nu confirmă ceva: **Change** (Schimbă) (sau **Choose a face** (Alege un font) pe un rol gol) deschide **scena de comparație** limitată la acel rol.

![Camera Type - cardurile de rol și un specimen live al fiecărui font în acțiune](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Scena de comparație

Scena se deschide **direct în cameră**, nu într-un dialog, așa că nu pierzi cardurile de la care ai pornit. Caută o familie din Google Fonts (Inter, Fraunces, Space Grotesk...) sau lasă un fișier de font, apasă **Add to the comparison** (Adaugă la comparație) și candidații stau unul lângă altul, în aceleași cuvinte, înainte ca vreunul dintre ei să se instaleze. Escape anulează și predă tastatura înapoi cardului de la care ai deschis-o.

Aceasta este singura ușă de intrare, motiv pentru care nimic nu intră în brandul tău nevăzut. Sub scenă se află cele două panouri de gestionare:

- **Fonts on this device** (Fonturi pe acest dispozitiv) - fiecare familie instalată, rolurile pe care le deservește și o opțiune de ștergere. **Add a face** (Adaugă un font) aici deschide aceeași scenă de comparație, fără limitare de rol.
- **Your fonts** (Fonturile tale) - încarcă un **TTF**, **OTF** sau **WOFF** de pe propriul calculator. Acesta este drumul pentru un font corporate licențiat pe care îl deții deja.

Oricum ar fi, fontul rămâne pe acest dispozitiv, se randează în aplicație, în uneltele tale și în fiecare export, offline pentru totdeauna, și călătorește în pachetul tău de brand - nimic nu este preluat în momentul randării. Tot ce se află pe Google Fonts este livrat sub o licență deschisă (OFL/Apache/UFL).

Panoul **Type roles** (Roluri de font) de la bază arată un specimen live al fiecărui rol - text de bază și UI în fontul principal, un font de afișare opțional pentru titlurile de sus, un italic pentru accentuare, un monospațiat pentru cod și date - astfel încât poți vedea tot setul funcționând împreună.

![Specimenul rolurilor de font - titlu, text de bază, italic și cod, fiecare setat în fontul spre care se rezolvă rolul respectiv, cu numele fontului alături](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokenuri

Restul sistemului de design, editabil fără să atingi codul:

![Camera Tokens - un cursor pentru raza colțurilor plus spațiere, dimensionare, umbre și restul sistemului](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** (Colțuri rotunjite) - un singur cursor de rază (0-1.5rem) pe care îl urmează cardurile, butoanele și panourile din întreaga aplicație.
- **More tokens** (Mai multe tokenuri) - adaugă și editează **spacing** (spațiere), **sizing** (dimensionare), **stroke width** (grosime contur), **opacity** (opacitate), **rotation** (rotație), **numbers** (numere) simple și **shadows** (umbre). Alege un tip, dă-i un nume (*Gutter, Card shadow...*) și setează-i valoarea. Acestea sunt stocate ca [tokenuri de design](/info/design-tokens.html) standard (DTCG) și călătoresc împreună cu brandul tău.

## Fișiere

Lasă aici fișierele pe care le păstrează brandul tău - în afară de logo-uri: active **vectoriale**, de **imagine**, **audio** și de **animație** (video, Lottie, animate). Ajung în [Catalogul](/info/using.html) tău, sortate pe secțiuni și gata de folosit în selectorul de active al fiecărei unelte. Totul rămâne pe acest dispozitiv. (Bara laterală etichetează camera **Files** (Fișiere); cheia din URL rămâne `catalogue`, pentru că o cheie de panou este un contract permanent.)

## Adu un brand

**Add from...** (Adaugă din...) de la baza barei laterale deschide un selector în două etape. Prima etapă întreabă ce *ai*, nu ce format este:

- **Design tokens or a design file** (Tokenuri de design sau un fișier de design) - JSON DTCG sau Tokens Studio, un proiect Penpot, o **arhivă zip cu seturi de tokenuri**, un pachet de sistem de design Lolly sau un SVG.
- **PDF** - un deck sau un fișier de ghiduri, citit pe acest dispozitiv pentru culorile, marcajele și fonturile sale încorporate.
- **Image** (Imagine) - o captură de ecran sau o fotografie; culorile ei sunt citite pe acest dispozitiv și nimic nu este încărcat.
- **Font file** (Fișier de font) - TTF, OTF sau WOFF. Deschide camera Type, unde fontul se instalează.
- **Website** (Site web) - o singură pagină, citită pentru culorile și fontul ei. Această filă apare doar pe un dispozitiv care poate chiar citi o pagină, pentru că o filă dezactivată care promite ceva ce nimeni nu poate apăsa este mai rea decât nicio filă. Acolo unde apare, numește clar cine citește: preluată de aplicație pe acest dispozitiv, sau citită prin extensia de browser într-un tab de fundal, autentificat ca tine. Introducerea unei adrese URL doar *precompletează* câmpul - butonul de preluare este consimțământul, deci un link trimis de altcineva nu poate porni niciodată o citire.

Alege sursa fișierului de design, iar a doua etapă este cardul de mai jos: formatele acceptate conduc ca file cu iconițe, în ordinea preferinței, iar întregul card este o singură zonă de plasare - apasă oriunde pe el sau trage un fișier peste el. Poți de asemenea să tragi un fișier direct în studio.

![Cardul de import - formatele acceptate conduc ca file cu iconițe, iar întregul card este o singură zonă de plasare](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Ce îți oferă fiecare fișier de design:

- un pachet **LollyBrand** (`.zip`) - se instalează într-un singur pas;
- un export **Penpot** (`.penpot`) - preia tokenurile lui de design;
- un fișier **Design Tokens** (`.json`) - W3C DTCG;
- un fișier **Tokens Studio** (`.json`) - Tokens Studio;
- un **SVG simplu** (`.svg`) - Lolly îi scanează culorile și te lasă să alegi pe care să le păstrezi, prima devenind culoarea ta principală.

O instalare din sursă creează mai întâi un **punct de control**, deci „revino la starea dinaintea importului” înseamnă o singură restaurare. Iar ce găsește o scanare nu intră direct: candidații ajung în **Tray** (Tavă), unde fiecare este adăugat printr-o apăsare proprie, prin camera care deține acel tip de material.

`#/start?source=<kind>` deschide selectorul pe o sursă dată (`file`, `pdf`, `image`, `font`, `url`), iar `?import` îl deschide pe lista simplă.

## Mută un brand între dispozitive

**Export** de la baza barei laterale scrie o singură arhivă **`LollyBrand-…zip`** - tokenurile, fonturile, logo-urile și preferința de temă, cu un manifest de integritate pe care îl verifică la reintroducere. Alături, **Tokens (.json)** scrie doar documentul simplu de tokenuri de design: fără fonturi, fără logo-uri, doar tokenurile, ceea ce citește de fapt un depozit de cod, un pas CI sau o altă unealtă de tokenuri.

Aducerea uneia înapoi se face prin **Add from... → Design tokens or a design file** (mai sus), sau prin tragere directă în studio. Așa îți dă un coleg un brand, sau așa duci unul la o a doua instalare - fără cont, fără cloud. Pentru a aduce un brand din linia de comandă în schimb, vezi [`ingest:brand`](/info/configuration.html#brand-packs).

## Versiuni

**Versions** la baza barei este locul unde un sistem de design încetează să mai fie o țintă mobilă. Publică una și obții o **copie permanentă, cu nume** păstrată pe acest dispozitiv: nu se mai schimbă niciodată după aceea, așa că un instrument care o fixează continuă să deseneze același lucru. Panoul rămâne ascuns până există ceva al tău de publicat, astfel încât un studio care nu publică niciodată nu vede niciodată aceste comenzi.

Trei lucruri de știut înainte să apeși orice, iar panoul le spune pe toate trei înainte de apăsare, nu după:

- **O versiune este permanentă.** Nu există încă ștergere, așa că panoul declară ce a fost păstrat și că rămâne păstrat, în loc să ofere un buton care minte.
- **Eliminările conduc cardul de compatibilitate.** Tokenurile adăugate și modificate sunt noutăți; unul *eliminat* este ceea ce strică un instrument, așa că este numit primul și numit exact ceea ce este.
- **Publicarea nu poate fi anulată; restaurarea poate.** *Restore latest from this version* este o modificare obișnuită a capului, așa că merge pe stiva de anulare a studioului, iar panoul îți oferă imediat **Undo**.

Poți **Publish only**, sau **Publish and make active** - diferența fiind dacă tool-urile și aplicația urmează de acum acea versiune sau continuă să urmeze ultima ta editare. **Follow the latest again** pune fiecare editare live în momentul în care e făcută. `#/start?area=versions` deschide panoul direct.

## Când brandul este fixat

Unele build-uri livrează un **brand blocat** - culorile, fonturile și token-urile lui sunt ce folosesc toate tool-urile și exporturile, și nu e nimic de schimbat. În acest caz studioul este înlocuit cu o notă scurtă care explică faptul că acest build vine cu un brand fixat și editarea este dezactivată. Acest lucru e intenționat: așa garantează o organizație că totul rămâne on-brand.

## Ce urmează

- **[Using Lolly](/info/using.html)** - canvasul, salvarea, proiectele și catalogul.
- **[Design Tokens](/info/design-tokens.html)** - modelul de token-uri în care e exprimat brandul tău.
- **[Exporting & formats](/info/exporting.html)** - unități de tipar, CMYK și formatele în care se randează brandul tău.
