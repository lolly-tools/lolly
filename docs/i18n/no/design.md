# Design: det frie lerretet

Design er verktøyet for layouter ingen mal dekker: en plakat fra grunnen av, en presentasjon med lysbilder, et bevegelsesstykke med lydspor. I stedet for et skjema med kontroller får du et lerret med bokser du drar, endrer størrelse på, roterer og skriver i. Det eksporterer gjennom den samme gjengivelsesveien som alle andre verktøy, så det du ser på lerretet, er filen du får.

Denne siden går gjennom lerretet fra den første boksen til en ferdig presentasjon: vinduet, å forme bokser, å tegne egne former, å plassere 3D-scener og andre verktøy, å legge til tid, å sjekke resultatet og å presentere den ferdige presentasjonen. [Using Lolly](/info/using.html) dekker det Design deler med alle verktøy, som å lagre og dele.

![Designs frie canvas - tegnebrettet med det omkringliggende monteringsbrettet](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Design-vinduet

**Toppmenyen** starter med **Home**, **File menu** og dokumentets navn (klikk på navnet for å gi dokumentet nytt navn). Midten har **Undo**, **Redo**, **History**, zoomkontrollene (med **Fit all** og **Fit artboard**) og brytere for **Timeline**, **Navigator** og **Inspector**. Til høyre ligger **Share**, **Present** og **Export**. På en telefon flyttes de mindre brukte knappene inn i **More actions**.

**Verktøylinjen** nedover siden har Lolly-menyen og verktøyene du tegner med: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, deretter knappene Timeline, Artboards og Auto-arrange.

![Verktøylinjen på det frie canvaset: et draghåndtak, Lolly-menyen, så Peker, Legg til en boks, Penn, Rediger punkter, Linje, Tidslinje, Tegnebrett og Auto-ordne](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Lerretet fungerer som en designers arbeidsflate rundt tegnebrettet:

- **Parker bokser utenfor tegnebrettet.** Dra en boks forbi rammekanten, så er den fortsatt synlig og kan velges. Alt utenfor rammen er bleket, og rammen beholder skyggen sin for å markere hvor filen begynner.
- **Bare tegnebrettet eksporteres.** Alt utenfor rammen, eller delen av en boks som henger over kanten, beskjæres bort fra resultatet i både raster- og vektorformater.
- **Zoom ut forbi Fit** for å se alt du har parkert.
- **Endre størrelsen på tegnebrettet** ved å endre eksportstørrelsen. Boksene beholder posisjonene sine, så du kan innramme en layout på nytt rundt eksisterende innhold.

![Redigeringsscenen: tegnebrettet foran og i midten, verktøylinjen til venstre og zoom-HUD-en i hjørnet](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator og Inspector

**Navigator** lister hvert tegnebrett (med overskriften **Artboards**, eller **Slides** i en presentasjon) som en sammenfoldbar gruppe av sine **Layers**. Velg navnet på et tegnebrett for å hoppe dit, utvid det for å velge eller omorganisere lagene og bruk piltastene for å bevege deg gjennom listen; Venstre går tilbake til tegnebrettets overskrift. **Pages** grupperer tegnebrett i navngitte sider, og å velge en side endrer bare hvilke tegnebrett redigeringsprogrammet viser.

**Inspector** setter tekst- eller bildekontrollene til det valgte objektet først. Alternativbrikker dekker de raske valgene, og **Advanced** holder stildetaljene. På en telefon åpnes Inspector som et ark fra **More actions**; Escape eller Back lukker arket og beholder utvalget ditt.

![Dokumentdelen i Inspector: fanene Selection og Canvas, deretter Dimensions og Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Endre størrelse, skaler og roter

Velg et objekt, og dra deretter et håndtak for å endre størrelsen, eller dra det runde håndtaket under utvalget for å snu objektet. Et størrelsesdrag fungerer i en av to moduser:

- **Resize**, standarden, endrer bare boksen. Teksten brytes om til den nye størrelsen, og skriftstørrelse, strekbredde, hjørneradius og effekter forblir som de var.
- **Scale** gjør hele objektet større eller mindre med innholdet: skriftstørrelse, strek, hjørneradius, skygge, uskarphet, utfylling og avstand endres alle med samme faktor.

Trykk `K` for å slå Scale på eller av. Uten tastatur velger du **Scale mode** i Lolly-menyen, eller trykker og holder **Pointer**-knappen på linjen (eller høyreklikker på knappen) og velger **Scale**; på en berøringsskjerm har objektlinjen også en Scale-bryter. Mens Scale er på, viser Pointer-knappen Scale-ikonet, og hvert håndtak har en prikk i midten. `V` eller **Escape** går tilbake til Resize og beholder utvalget ditt. Hvert dokument åpnes med Scale av, så ingen skalerer streker ved en feiltakelse.

**Skaler med et tall.** Med Scale på, eller med flere objekter valgt, klikker du på avlesningen på objektlinjen for å åpne **Scale**-popoveren. Skriv en prosent, en bredde eller en høyde, velg punktet som blir stille på 3 x 3-rutenettet, og velg **Apply**. Hver skalering er ett angretrinn.

**Flere objekter.** Et utvalg av flere objekter har håndtak på kantene i tillegg til hjørnene. Så lenge hvert objekt står oppreist eller er snudd i hele kvartsvinger, og utvalget ikke inneholder noen gruppe eller sirkel, endrer et hjørnedrag bredde og høyde fritt. Ellers beholder utvalget proporsjonene sine, og avlesningen legger til **Proportional**. Mens du drar, viser en liten etikett størrelsen, eller prosenten i Scale-modus.

**Speilvend et utvalg.** Høyreklikk og velg **Flip horizontal** eller **Flip vertical**, eller trykk `Shift+H` eller `Shift+V` (Shift, fordi en bar `V` er Pointer). Speilingen er en ekte transformasjon, så den eksporterte SVG-en, PDF-en og PNG-en beholder speilingen.

**Taster du holder under et drag** trer i kraft i det øyeblikket du trykker eller slipper dem; snarveisarket (`?`) lister dem også.

| Hold | Endre størrelse eller skalere | Rotere | Flytte |
|---|---|---|---|
| **Shift** | Beholder proporsjonene (Scale gjør det alltid) | Snur i trinn på 15 grader | Ingen endring |
| **Alt** (Option) | Fungerer fra midten | Snur fritt | Slår av snapping og rutenettet |
| **Cmd/Ctrl** | Slår av snapping og rutenettet | Snur fritt | Slår av snapping og rutenettet |

Uten noen tast holdt trekkes en snuing til nærmeste 15 grader når den kommer innenfor 4 grader av en. Tegnebrett roterer ikke, så de har ikke noe rotasjonshåndtak.

::: details Håndtak, grepsoner og berøring
**Grip hvor som helst langs en kant.** Hver side av et utvalg er en størrelsesstripe langs hele lengden, og med mus eller penn finnes det en rotasjonssone like utenfor hvert hjørne. Pekeren viser hva et drag vil gjøre. Et trykk i en stripe eller sone blir først en størrelsesendring eller en snuing når du begynner å dra, så et vanlig klikk velger som før. Et låst objekt har ingen håndtak, striper eller soner.

**Små objekter kan fortsatt flyttes.** På et objekt som er 25 skjermpiksler eller mindre på tvers, skjules midthåndtakene, og de andre flytter seg et lite stykke ut fra omrisset, så et trykk på objektet flytter objektet. Ved 10 piksler eller mindre forsvinner også hjørnehåndtakene, og en tynn linje beholder ett håndtak i hver ende. Et trykk like ved siden av en tynn linje eller et lite objekt, unna håndtakene, flytter objektet.

**Store grepsområder.** På en berøringsskjerm er hver hjørnesone en fjerdedel av utvalgets bredde og høyde på skjermen, mellom 24 og 44 piksler, og hver sidesone dekker strekningen mellom to hjørner. Når utvalget er for lite til det, flytter sonene seg utenfor omrisset. Sonen under pekeren eller fingeren din er skravert. For å få de samme sonene med mus eller penn, slå på **Large grab areas** i Lolly-menyen; innstillingen blir på denne enheten.

**To fingre på et utvalg.** På en berøringsskjerm legger du to fingre på et valgt objekt: klyp for å skalere, vri for å snu eller flytt begge fingrene for å bære utvalget, alt som ett angretrinn. Med Scale på skalerer en klyping også innholdet; med Scale av endrer den størrelsen proporsjonalt. En vriing festes til nærmeste 15 grader når den er nær, og en tofingerflytting festes aldri. Den første fingeren må lande på utvalget, og den andre må følge raskt, på utvalget eller like utenfor kanten. To fingre hvor som helst ellers zoomer og panorerer visningen, og det samme gjør to fingre på et utvalg som inneholder et tegnebrett eller et låst objekt, dekker det meste av visningen eller går forbi kanten.
:::

## Tegn dine egne former

Bokser, sirkler og avrundede rammer dekker de fleste layouter. For en hvilken som helst annen form, tegn en: **Pen**-knappen på linjen (eller `P`) setter deg i tegnemodus. Tre enkelttaster flytter mellom modusene: `V` for Pointer, `P` for Pen og `N` for **Edit points**. Pointer er alltid veien ut.

- **Klikk** for å plassere et punkt. På standard kurvetype trekker **klikk og dra** ut punktets håndtak for å lage en kurve; hold **Alt** mens du klikker for et hardt hjørne. (På de andre kurvetypene er hvert punkt et hjørne, og et drag gjør ingenting.)
- Punkter festes til tegnebrettet og de andre boksene dine mens du plasserer dem. Alt slår av rutenettet mens du tegner, og både rutenettet og kantene mens du drar et punkt etterpå.
- **Klikk på det første punktet** for å lukke formen. Ellers trykker du **Enter**, dobbeltklikker eller bytter verktøy, så beholdes tegningen.
- **Escape** virker ett trinn om gangen: første trykk forlater tegningen, andre trykk forlater pennen.
- **Delete** mens du tegner fjerner det siste punktet.

Resultatet er en vanlig boks. Flytt, endre størrelse på, roter, grupper, juster, endre stablerekkefølge for, fyll, skygg eller tone ut banen som en hvilken som helst annen boks. Den første banen får fyllet og streken merkevaren din gir en bane, og hver nye bane etter det får det du brukte sist. I et verktøy der merkevaren ikke setter noe for baner, får en ny bane strek i fargen du tegnet med, så formen aldri er usynlig.

**Rediger punktene igjen.** Dobbeltklikk formen, eller bruk **Edit points** på objektlinjen. Dra et punkt for å flytte det, dra et håndtak for å sikte kurven på nytt, klikk på kurven for å sette inn et punkt eller dra en boks rundt flere punkter og trykk Delete. En bane beholder alltid minst to punkter.

**Spline type** avgjør hva slags kurve som går gjennom punktene dine:

| Type | Hva den gjør |
|---|---|
| **Smooth (auto)** | Standarden. Regner ut sine egne håndtaklengder, så vanlige klikk gir en jevn kurve. Et håndtak du setter, fester retningen, og kurven eier fortsatt lengden. |
| **Bezier handles** | Den klassiske pennen: du styrer hvert håndtak, og å sette inn et punkt flytter aldri kurven. |
| **Through the points** | Går nøyaktig gjennom hvert punkt, uten håndtak. |
| **B-spline** | Flyter nær punktene i stedet for gjennom dem, for en mykere linje. |
| **Straight lines** | En polylinje. |

Å bytte en eksisterende bane til en type som regner ut sine egne håndtak, spør først, fordi håndtaklengder du har satt, ikke kan gjenopprettes; å bytte til **Bezier handles** er alltid tapsfritt. Midt i tegningen gjelder byttet med en gang, og håndtak du hadde trukket ut, fjernes.

Hvert punkt har også en kontinuitetsregel, vist med formen: firkantet for **Corner** (håndtakene beveger seg uavhengig), rund for **Smooth** (håndtakene holder seg på linje) og rund med en ring for **Symmetric** (på linje og like lange). Sett regelen for valgte punkter, så følger kurven med en gang.

![To pennebaner rendret rett fra en lenke: en S-kurve med strøk og en lukket, fylt klatt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

En tegnet bane følger med i en delingslenke som en hvilken som helst annen boks og gjengis likt fra kommandolinjen.

## Kombiner former

Velg to eller flere former, høyreklikk lerretet (tofingertrykk på berøring) og velg:

- **Union** slår dem sammen til én form med malingen til den øverste.
- **Subtract** skjærer bort alt over fra den nederste formen.
- **Intersect** beholder bare overlappingen.
- **Exclude** beholder alt unntatt overlappingen.

Tre til virker på én enkelt form. **Outline stroke…** gjør en strek om til en fylt kontur med samme tykkelse. **Offset path…** vokser konturen utover eller, med et negativt tall, krymper den innover. **Simplify** bygger en bane på nytt med færre segmenter og samme kontur.

![En halvmåne og en ring med et ekte hull, begge laget med Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Resultatet er en ny bane du kan fortsette å redigere med pennen, lagret som vanlige Bezier-kurver, så den opprinnelige splinetypen følger ikke med. Hull er ekte hull: kontrollen **Fill rule** i strekpanelet avgjør om overlappende konturer fylles (*non-zero*) eller stanses ut (*even-odd*). Operasjonene nekter heller enn å ødelegge: be om å skjære to former som ikke overlapper, og ingenting endres. Tekst- og bildebokser har ingen kontur, så de lades i fred.

## 3D-scener og verktøy inne i et design

En boks kan holde mer enn et bilde. Begge typene nedenfor beholder en oppskrift i stedet for et gjengitt bilde, så de tegnes på nytt i den størrelsen og det øyeblikket dokumentet ber om, og en oppdatering av kilden når hvert design som bruker kilden.

### 3D-scener

Velg **3D scene** fra tilleggsmenyen på linjen og dra ut en ramme: 3D Studio åpnes på den nye boksen, og det du setter der, kommer tilbake til lerretet. Etterpå åpner **Edit in 3D Studio** i delen **3D scene** i Inspector studioet igjen. [Place a scene in Design](/info/3d-studio.html#place-a-scene-in-design) dekker plakater, tidslinjen, eksport og deling.

### Verktøy inne i et design

Velg **Image** fra tilleggsmenyen på linjen, dra ut en ramme og velg et verktøy på fanen **Tools** i velgeren. Verktøyet fyller rammen med standardverdiene sine, og Inspector åpnes på en **Tool**-del med verktøyets egne kontroller. Endre et felt, så oppdateres boksen et øyeblikk senere, som ett angretrinn. **Image fit** og **Image position** fungerer som for et hvilket som helst bilde, og **Replace with another tool or image** bytter ut boksens innhold.

**Verktøy som beveger seg** spilles av inne i boksen: en looping-illustrasjon fortsetter å loope på lerretet, følger avspillingshodet når tidslinjen er åpnet og eksporterer bilde for bilde til GIF, MP4 eller WebM. Når verktøyet sier hvor lenge én løkke varer, får boksen et klipp akkurat så langt, så en video holder hele løkker. Et klipp du har retimet, beholder timingen din, og å slå av verktøyets bevegelse gjør boksen til et stillbilde igjen.

## Tidslinje (Sequence)

**Sequence** er Designs tidslinje: den legger tid til lerretet. Hver boks kan starte på et tidspunkt, vare en lengde og animeres inn og ut, og tidslinjen forankret under tegnebrettet er der du ordner dem. Start fra Designs **Video**-mal, så er en kort sekvens allerede på plass: to tidsbestemte tekstkort på sekvensraden og et prosedyrelt musikkteppe under dem, slik at du kan se hvordan tidslinjen fungerer før du endrer noe.

![Sequence-tidslinjen: transporten, linjalen, et overleggsspor, den magnetiske sekvensraden med klippene og skjøtebrikkene, og Always on-stripen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Det finnes to typer rader:

- **Sekvensraden** er magnetisk. Klipp ligger ende mot ende, å dra ett endrer rekkefølgen og å slette ett lukker gapet. Dette er ryggraden.
- **Overleggsspor** er frie. En lower-third, en logo eller en bildetekst flyter over ryggraden på sitt eget tidspunkt, hver i sitt eget spor.
- Under dem holder **Always on** bokser uten timing, til stede hele veien gjennom. `+` på en brikke flytter en til et spor; **Make always on** sender den tilbake.

Å åpne tidslinjen gir den tastaturet, så Space og piltastene styrer avspillingshodet. En komposisjon som allerede har timing, åpner tidslinjen av seg selv.

**Redigering.** Dra midten av et klipp for å flytte det, dra nær en av endene for å trimme det og trykk **Split at playhead** (eller `S`) for å kutte det i to. Split trenger et klipp med en ekte **Length** og avspillingshodet et stykke innenfor det, så et åpent klipp som musikkteppet kan ikke deles. **Snap to edges** er på som standard og fester til klippkanter, avspillingshodet og hele sekunder; hold Alt for å dra uten festing. Hvert drag er ett angretrinn, og forhåndsvisningen mens du drar, bruker den samme aritmetikken som resultatet.

Velg et klipp, så gir inspektøren de samme redigeringene som tall: **Length**, **Trim in** (hvor langt inn i kilden klippet starter), **Speed** fra ×0.25 til ×4, **Animate in** og **Animate out** med lengdene sine og **Mute clip**. Et klipp på den magnetiske raden har ikke noe **Start**-felt, fordi raden eier rekkefølgen.

**Transitions** er forhåndsinnstillinger: Fade, Pop, Grow, Rise, Drop, de fire Slides, Zoom in og out, Tilt, Swoop, Spin, Drift eller **Cut (no animation)**. Avstander skaleres med objektet, så én forhåndsinnstilling fungerer riktig på et fullrammekort og et lite merke. Mellom to klipp på sekvensraden velger en **seam chip** **Cut** eller **Crossfade**; åpne den igjen for å sette **Length (ms)** og trykk **Done**. I en crossfade spilles det første klippet videre forbi snittet og toner ut mens det neste toner inn, likt i forhåndsvisningen og filen.

**Lyd.** Et **Audio**-klipp lever på tidslinjen som alle andre klipp, med bølgeform, trimming og demping. Videomalens genererte musikkteppe syntetiseres ved eksport, så stolpen forblir enkel og stille til du gjengir. Trykk på mikrofonen for å **spille inn en voiceover** rett på tidslinjen, med nedtelling og nivåmåler; opptaket lagres som din egen ressurs ved avspillingshodet. Kameraknappen ved siden av mikrofonen **tar opp en video** på samme måte, beskåret til tegnebrettet mens den tas opp, slik at en kollega kan legge til et klipp fra en delt lenke. Velg et hvilket som helst klipp med lyd, så åpnes strimmelen under tidslinjen for volum, panorering, EQ, tonehøyde, normalisering og effekter som **Voice cleanup**; [Sound](/info/sequence-editor.html#sound) i veiledningen for sekvensredigering dekker strimmelen. **Audio track** i eksportpanelet er adskilt: ett teppe under hele klippet, med fade og ducking.

![Tidslinjen med musikkklippet valgt: stripen langs bunnen viser Hastighet, Toninger, Volum, Panorer, EQ, Tonehøyde, Normaliser volum og Effekt-plassen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Gjengivelse.** En bevegelseseksport tegner, dekoder og koder hvert bilde på et eksakt tidspunkt, så filen avhenger ikke av at maskinen din henger med, og MP4 og WebM har ingen praktisk bildetaksgrense. Tidslinjens lengde setter varigheten med mindre du skriver en, og Content Credentials stemples som på enhver annen eksport. En stillbildeeksport gir bildet ved avspillingshodet, eller et kontaktark fra feltet **Frames**; se [Stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition). En sekvens er begrenset til én time. GIF og animert PNG holder hvert bilde i minnet, så de passer for korte klipp. **Record live** er skjult her fordi bilde-for-bilde-gjengivelsen er den bedre veien.

**Nøkkelbilder, dybde og et kamera.** En overgang animerer et klipp når det kommer og går. For å posere en boks innenfor et klipp (drift, fade, uskarphet, løft den av siden og la den sette seg igjen), velg klippet og trykk **+Keyframe**: diamanten i tidslinjens verktøy, diamanten på lerretets objektlinje eller **Shift+K** med tidslinjen i fokus. Avspillingshodets posisjon avgjør hvilken positur din neste redigering skriver. De samme nøkkelbildene gir en tidsbestemt komposisjon et kamera som skyver inn, panorerer og trekker fokus. [Animating](/info/animating.html) er den fulle veiledningen, og [The sequence editor](/info/sequence-editor.html) dekker utvalg, løkeskall, deling, trimming og markører.

## Før du eksporterer

Design sjekker dokumentet ditt før du sender filen. Kortet **Before you export**, i delen **Document** i Inspector og igjen i eksportpanelet, leser den lagrede lagstrukturen og ser deretter på det ferdige lerretet etter avklippet tekst og kontrast mellom flate farger. Det spør det samme skriftregisteret som SVG- og PDF-konturgjøringen bruker, om hver tekstkjøring har skriftbytes som kan bygges inn. Bilde- og gradientbakgrunner listes som visuelle kontroller i stedet for å få en oppdiktet kontrastscore.

### Sjekk en komposisjon mot designsystemet

Kortet i eksportpanelet sammenligner også komposisjonen med designsystemet ditt, i samme designsystemversjon som gjengivelsen bruker. Det ser på forfattede farger, tokenaliaser, skriftvalg og bilderessurs-ID-er. En egendefinert verdi kan være tilsiktet, og et bilde utenfor de deklarerte merkevareressursene er noe å gjennomgå, ikke et forbudt bilde.

Der det finnes et konkret forslag til farge eller skrift, endrer knappen det ene laget, og **Undo** gjenoppretter originalen. Låste eller siden endrede lag overskrives aldri av et gammelt forslag. Gradienter, effekter, nestet verktøyinnhold, rettigheter og subjektiv kvalitet ligger utenfor denne sammenligningen, og ingen sjekk blokkerer Download.

### Interne regler og skrivesignalet

Kortet i eksportpanelet sjekker også de interne reglene designsystemet ditt har med seg, som tekstvekt og justering, godkjente fargepar eller en logo per flate, lag for lag. Hvert funn er en advarsel med lagets navn over regelen. En regel dette bygget ikke har noen kontroll for, listes som ikke sjekket, aldri som fulgt. [Usage & rules](/info/brand-studio.html#usage-rules) lister reglene, og `lolly check` bruker de samme på et lagret dokument.

Det samme kortet viser skrivesignalet for teksten dokumentet tegner: båndet (none, weak, notable eller strong), deretter Verifys egen setning med poengsummen av 100 og opptil tre flaggede fraser, hver med laget som holder dem. **Open the text in Verify** tar den teksten til [Verify](/#/verify) for den fulle avlesningen; [AI evidence in Verify](/info/verify-ai-evidence.html) forklarer hva poengsummen veier. Poengsummen er et signal, ikke en dom: den teller mønstre som er vanlige i generert skriving og kan ikke si hvem som skrev ordene. Skjulte lag utelates fra begge sjekkene, og kortet sier hvor mange.

Funn mot interne regler og et sterkt skrivesignal teller med i kortets "to fix"-sum, så de er lette å finne. De informerer og blokkerer aldri: Download forblir tilgjengelig, og det er ingenting å avvise eller registrere som unntak. En agent som arbeider i det åpne dokumentet, får den samme rapporten gjennom nettstedsverktøyene sine ([Agents in an open document](/info/open-document-agents.html)).

Trykkkontrollene (utfall, oppløsning, fargedekning og antall plater) kommer med på det samme kortet når du slår på **Settings → Feature flags → Print preflight**. I andre verktøy er det flagget som i det hele tatt viser kortet; [Export a file](/info/exporting.html) beskriver trykkontrollene.

## Presentere

Et Design-dokument laget av tegnebrett er allerede en presentasjon. Trykk **Present** i toppmenyen, så blir hvert tegnebrett et fullskjermslysbilde, i den rekkefølgen tegnebrettene ligger på lerretet. Knappen heter **Preview** til dokumentets **Design outcome** er **Slides**. Presentasjonen kjører på en kopi av de gjengitte tegnebrettene, så å gå ut setter deg tilbake akkurat der du var.

Pilen ved siden av **Present** åpner **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** og **Export slides as video**.

| Tast | Hva den gjør |
|---|---|
| **Space**, `→`, **Page Down** | Neste trinn eller lysbilde (eller klikk på stripen ved høyre kant) |
| `←`, **Page Up** | Tilbake (eller klikk på stripen ved venstre kant) |
| **Home**, **End** | Første eller siste lysbilde |
| `O` | Oversikt: hvert tegnebrett i lerretsarrangementet ditt; klikk på ett for å åpne det |
| `S` | Speaker view: gjeldende lysbilde, neste lysbilde, notater og en klokke i et andre vindu |
| `B` | Svart skjerm; en hvilken som helst tast bringer lysbildet tilbake |
| `F` | Tilbake til fullskjerm |
| `K` | Pause eller start en kioskpresentasjon på nytt |
| **Escape** | Skreller av ett lag: oversikt til presentasjon, presentasjon til redigeringsprogram |

En liten kontrolllinje toner inn når du beveger pekeren og skjules igjen når du stopper. Hvis nettleseren blokkerer popup-vinduet for taleren, åpnes speaker view som et panel over presentasjonen. Notater tilhører hvert tegnebrett og vises aldri på lysbildet.

- **Avsløringstrinn.** Høyreklikk en boks og velg **Reveal at step 1**, **2** eller **3** i stedet for **Always visible**, så venter boksen til du går videre til trinnet. Bokser med samme nummer kommer sammen.
- **Kiosk.** Gi et tegnebrett en **Length**, så blir presentasjonen stående så lenge, og går deretter videre bak en tynn fremdriftslinje. Legg `kiosk` til i lenken, så starter presentasjonen om igjen ved slutten, for skilting.
- **Undersklidestabler.** Høyreklikk et tegnebrett og velg **Stack under the previous slide** for å gjøre det til et trinn i det lysbildet. Oversikten viser ett kort, og raden **Stack** i inspektøren sier hvilket lysbilde tegnebrettet tilhører.
- **Morph.** Når to påfølgende lysbilder begge har en boks med samme navn i **Morph match** (for eksempel `hero`), flytter, endrer størrelse på og fargelegger overgangen den boksen på nytt i stedet for å klippe. En **Morph**-overgang for hele presentasjonen gjør det samme for hvert samsvarende par.
- **Fortelling.** Hvert tegnebretts **Speaker notes** kan leses opp. I delen **Document** i Inspector velger du en **Voice**, eventuelt en andre stemme å **Blend with**, **Speed** og en **Lead-in** og **Tail** i millisekunder; **Show captions when presenting** viser ordene mens de blir sagt. Stemmen kjører på enheten din, og de samme notatene blir lydsporet i en videoeksport, lysbildelyd i en PowerPoint-eksport og den innleste filmen i en [SCORM-pakke](/info/create/exporting.html#scorm-course-packages).

Presentasjonen er en lenke også. `?present` åpner rett inn i den og `s=` velger lysbildet (en posisjon, en tegnebrett-ID eller `id.step` for et byggetrinn), og adressen følger deg, så det du sender, er lysbildet du er på. [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open) dokumenterer dem.

**Present with camera** plasserer kameraet ditt, en logo og en navnelapp over lysbildene, med private kontroller og lagrede scener; se [Presenting with camera](/info/presenting.html). En **Web page**-boks kan ta klikkeren under et foredrag når du slår på **Make interactive** i inspektøren: ved trinnet **Focus on click** styrer Opp og Ned siden mens Neste fortsetter presentasjonen. [Live pages that take the clicker](/info/interactive-pages.html) dekker fokusstiler, rullestopp og nettstedsgodkjenning.

## Hvor du går videre

- **[Text in Design](/info/text-composition.html)**: å redigere tekst på lerretet, la artikler flyte gjennom rammer og typografi.
- **[Animating](/info/animating.html)**: nøkkelbilder, dybde, scenekameraet og Lift-lag.
- **[Import a design](/info/design-import.html)**: åpne en Figma-, Penpot-, Illustrator- eller InDesign-fil som redigerbare bokser.
- **[Share a design with rules](/info/create-a-tool.html)**: gjør et Design-dokument om til et verktøy med bare inndataene du velger.
- **[Export a file](/info/exporting.html)**: formater, størrelser, trykkenheter og video.
