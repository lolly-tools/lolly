# Slik bruker du Lolly

En praktisk veiledning i å faktisk *bruke* appen - åpne et verktøy, jobbe på canvaset, eksportere, lagre og dele. Alt her kjører **på enheten din**: ingen konto, ingen opplasting, ingen internettforbindelse etter første lasting.

> Ny her? [Hurtigstart](/info/quickstart.html) får deg i gang med å lage ting på minutter, og [Lolly for driftsansvarlige](/info/operators.html) dekker installasjon og utrulling av appen; denne siden handler om å styre den når den først er åpen.

## Åpne et verktøy

Hjemskjermen er **galleriet** - alle verktøy, gruppert etter kategori. Klikk på et kort for å åpne verktøyet; har du jobbet med det før, gjenopptar en **Fortsett**-knapp den siste økten din. Bruk søkefeltet for å filtrere etter navn - eller [Søk](/info/search.html) fra linjen nederst på de seks oversiktsskjermene (galleriet, Hjelpeverktøy, Prosjekter, Katalogen, Oversikten og Profil), som når fram til det du har lagret, katalogen og innstillingene dine i tillegg til verktøyene. Inne i et verktøy trer linjen til side for verktøyets eget grensesnitt.

![Verktøygalleriet - hvert verktøy som et kort, gruppert etter kategori](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Hvert verktøy er en delt visning: **kontroller** på den ene siden, en levende **forhåndsvisning** (canvaset) på den andre. Endre en kontroll, så oppdateres forhåndsvisningen umiddelbart.

![Et verktøys delte visning - kontrollstabelen til venstre, og det live grupperte stolpediagrammet det tegner til høyre](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Noen få verktøy (som **Design**) åpnes i stedet som et **fritt canvas** - en kromfri flate for direkte manipulasjon der du drar, endrer størrelse på, roterer og fester bokser med tekst, former og bilder, og dobbeltklikker for å redigere tekst på stedet. Det eksporteres via samme renderingsvei som alle andre verktøy, så canvaset *er* filen. Se [Det frie canvaset](#the-free-canvas-design) nedenfor.

To måter å forme selve rutenettet til det du vil ha:

- <!--i:star--> **Stjernemerk det du bruker.** Sett ★ på et kort, så får det sin egen store flis i en stripe over rutenettet - se [Favorittene dine](/info/favourites.html).
- <!--i:eyeoff--> **Skjul et verktøy du aldri bruker.** Høyreklikk et kort (eller velg flere og bruk utvalgslinjen) → **Skjul verktøy**. Det faller ut av rutenettet, og ut av det du finner ved å skrive i rutenettet; en grå flis **Vis skjulte verktøy (N)** helt til slutt henter dem fram igjen, nedtonet, hver med **Vis verktøy igjen** i sin egen meny. Skjuling gjelder bare ditt rutenett - verktøyet åpnes fortsatt fra en lagret lenke eller et bokmerke, og det blir stående nøyaktig der det var for alle andre.

![Slutten av verktøyrutenettet med de skjulte verktøyene framme: det nedtonede kortet QR Code Generator, og ved siden av den grå flisen som hentet det tilbake i visningen, som nå leser Skjul skjulte verktøy](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

### Spør Lolly

Når du heller vil spørre enn å lete, tar **Spør Lolly** (`#/ask`) imot et skrevet spørsmål og gir deg tilbake det avsnittet i denne dokumentasjonen som passer, **ordrett** - veiledningenes egne ord, ikke et sammendrag og ikke noe generert - med siden det kom fra oppgitt og en **Åpne i dokumentasjonen**-lenke ved siden av. Under svaret ligger stedene i appen som det samme spørsmålet treffer: et verktøy, en innstilling, et lagret prosjekt, hvert som en knapp som rett og slett navigerer dit.

Samtalen er øktminne: still et oppfølgingsspørsmål, så bygger tråden seg opp underveis, men last siden på nytt, og den starter på nytt. Søkeresultater har en rad **Spør Lolly: *søket ditt*** nederst - under de konkrete treffene de andre gruppene fant - som sender spørsmålet rett videre, så du kan starte i søkefeltet og avslutte her.

## Canvaset (forhåndsvisning)

Forhåndsvisningen viser alltid nøyaktig det som blir eksportert.

**Skrivebord**

- **Zoom:** Cmd/Ctrl-scroll, eller knip på en styreflate - zoomen sentreres om pekeren.
- **Panorer:** hold **mellomrom** og dra, eller dra med **midterste museknapp**. (Vanlige klikk er fortsatt ledige til å klikke på deler av designet.)
- **Tastatur:** `0` = tilpass til vinduet · `1` = 100 % · `+` / `−` = zoom.
- **Zoom-HUD:** den lille kontrollen `−  NN%  +  Fit` i hjørnet. Klikk på prosenten for å veksle Tilpass ↔ 100 %.

![Zoom-HUD-en i hjørnet av canvaset - minus, den levende prosenten, pluss, Tilpass, og så tema- og lydbryterne](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Berøring**

- **Knip** for å zoome, **dra** for å panorere, **dobbelttrykk** for å tilbakestille til tilpasset visning.

**Klikk for å hoppe til en kontroll:** klikk på et element i designet, så får det tilsvarende feltet i sidepanelet fokus og rulles fram - for en gjentakende radgruppe folder den ut nøyaktig raden du klikket på, slik at det å redigere det du ser er ett trykk unna.

En endring av dimensjonene fører alltid visningen tilbake til en ren tilpasning.

### Det frie canvaset (Design)

Verktøy med fritt canvas legger til en arbeidsflate *rundt* tegnebrettet, som en designers arbeidsbord:

- **Mellomlagring utenfor canvaset.** Dra en boks forbi rammekanten, og den forblir fullt **synlig og valgbar** - parker elementer til side mens du ordner komposisjonen, og dra dem så tilbake inn. Alt utenfor rammen er **svakt nedtonet**, slik at eksportområdet alltid er lett å lese, og rammen beholder skyggen sin for å markere nøyaktig hvor filen begynner.
- **Bare rammen eksporteres.** Den eksporterte filen avgrenses av tegnebrettet - alt som blir liggende utenfor (eller den delen av en boks som henger over kanten) blir rett og slett beskåret bort fra resultatet, i både raster- og vektorformater.
- **Zoom ut forbi Tilpass** (ned til 20 %) for å se hele arbeidsbordet når du har plassert ting langt utenfor rammen.
- **Tegnebrett med justerbar størrelse.** Å endre eksportdimensjonene endrer størrelsen på rammen der den står; boksene beholder posisjonene sine, så du kan ramme inn en layout på nytt rundt eksisterende innhold.

![Designs frie canvas - tegnebrettet med det omkringliggende monteringsbrettet](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Snu et utvalg.** Høyreklikk på en hvilken som helst boks og velg **Flip horizontal** eller **Flip vertical** for å speile den på stedet, eller trykk `Shift+H` / `Shift+V` på tastaturet - Shift, fordi en bar `V` er Pointer-verktøyet. Hver valgte boks speiles langs sin egen akse i ett angre-trinn, og speilingen er en ekte transformasjon, så den holder seg i den eksporterte SVG-, PDF- og PNG-filen, ikke bare på lerretet.

### Tegne dine egne former (pennen)

Bokser, sirkler og avrundede rammer dekker de fleste layouter. Når du trenger en form som ikke står på den listen, tegner du den: knappen **Penn** på verktøylinjen (eller tasten `P`) setter deg i tegnemodus. Tre enkelttaster flytter deg mellom modusene - **`V`** tilbake til Peker, **`P`** for Penn, **`N`** for nodeverktøyet (**Rediger punkter**) - og Peker er alltid veien ut av det du står i.

![Verktøylinjen på det frie canvaset: et draghåndtak, Lolly-menyen, så Peker, Legg til en boks, Penn, Rediger punkter, Linje, Tidslinje, Tegnebrett og Auto-ordne](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Klikk** for å plassere et punkt. På standard kurvetype trekker **klikk og dra** ut håndtakene til punktet, og det er slik du tegner en kurve i stedet for et hjørne - hold **Alt** mens du klikker for å få et hardt hjørne i stedet. (På de andre kurvetypene er hvert plassert punkt et hjørne, og dragingen gjør ingenting; se **Splinetype** nedenfor.)
- Punkter fester seg til tegnebrettet og til de andre boksene dine mens du plasserer dem, og tegner de samme hjelpelinjene som en vanlig draging gjør. Alt slår av rutenettet mens du tegner, og både rutenettet og kantene når du drar et punkt etterpå.
- **Klikk på det første punktet** for å lukke løkken og bli ferdig i én bevegelse. Ellers trykker du **Enter**, dobbeltklikker eller bare bytter verktøy - tegningen beholdes, den kastes ikke.
- **Escape** virker ett trinn om gangen: første trykk forlater tegningen uten å skrive noe, og et andre trykk avslutter pennen.
- **Delete** mens du tegner fjerner det siste punktet du plasserte.

Resultatet er en helt vanlig boks på canvaset. Flytt den, endre størrelsen, roter den, grupper den, still den opp, stokk om på rekkefølgen, gi den et fyll, en gradient, en skygge eller en gjennomsiktighet - en bane oppfører seg som alle andre bokser, og ingen av de kontrollene behandler den annerledes.

Den kommer ferdig malt også. Den første banen du tegner får fyllet og strøket merkevaren din gir en bane, og deretter får hver nye bane **det du sist brukte** - sett et fyll én gang og fortsett å tegne, i stedet for å farge om hver form. (I et verktøy der merkevaren ikke sier noe om baner, får en tegnet bane strøk i den fargen du så den bli tegnet i, så den er aldri usynlig.)

**Redigere punktene på nytt.** Dobbeltklikk formen (eller bruk **Rediger punkter** på objektlinjen), så kommer punktene tilbake. Dra et punkt for å flytte det, dra et håndtak for å sikte det på nytt, klikk hvor som helst på kurven for å sette inn et punkt, dra en markeringsramme rundt en gruppe punkter og trykk Delete for å fjerne de valgte. En bane beholder alltid minst to punkter, så du kan ikke slette den bort ved et uhell.

**Splinetype** avgjør hva slags kurve som går gjennom punktene dine, og det er valget som er verdt å forstå:

| Type | Hva den gjør |
|---|---|
| **Jevn (auto)** | Standardvalget. Regner ut håndtaklengdene sine selv, så vanlig klikk-klikk-klikk gir en virkelig jevn kurve uten håndtakfikling. Setter du et håndtak, låser det *retningen*, og kurven eier fortsatt lengden. |
| **Bezier-håndtak** | Den klassiske pennen. Håndtakene er kontrollpunktene, og å sette inn et punkt flytter aldri kurven. |
| **Gjennom punktene** | Går nøyaktig gjennom hvert punkt du plasserte, uten håndtak. |
| **B-spline** | Flyter nær punktene i stedet for gjennom dem, for en mykere form. |
| **Rette linjer** | En polylinje. |

Å bytte en eksisterende bane til en type som regner ut sine egne håndtak spør først, fordi håndtaklengdene du har satt ikke kan hentes tilbake - å bytte til **Bezier-håndtak** er alltid tapsfritt. Midt i en tegning kommer det ingen forespørsel: byttet gjelder utkastet direkte, og håndtakene du allerede hadde trukket ut, følger med. På typene som eier håndtakene sine, endrer et innsatt punkt kurven en ørliten smule; på **Bezier-håndtak** gjør det ikke det.

Hvert punkt har også en kontinuitetsregel, vist ved formen på canvaset - firkant for **Hjørne** (håndtakene beveger seg uavhengig), rund for **Jevn** (håndtakene holder linjen), rund med ring for **Symmetrisk** (i linje og like lange). Sett den for punktene du har valgt, så oppfyller kurven den umiddelbart.

![To pennebaner rendret rett fra en lenke: en S-kurve med strøk og en lukket, fylt klatt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

En tegnet bane følger med i lenken som alt annet, så en form du tegner åpnes igjen fra en delingslenke og rendres likt fra CLI-et. Ingenting ved den avhenger av editoren.

### Kombinere former (baneoperasjoner)

Velg to eller flere former, **høyreklikk** på canvaset (tofingertrykk på berøringsskjerm), så tilbyr menyen de operasjonene du forventer av et tegneprogram:

- **Union** slår dem sammen til én form og beholder fargen til den øverste.
- **Trekk fra** skjærer alt som ligger over bort fra den nederste formen.
- **Snitt** beholder bare overlappet.
- **Ekskluder** beholder alt unntatt overlappet.

Tre andre virker på én enkelt form: **Konturstrøk…** gjør et strøk om til en fylt form med samme kontur (nyttig når du vil beholde en tykkelse nøyaktig slik den er tegnet), **Forskyv bane…** utvider silhuetten utover eller, med et negativt tall, krymper den innover, og **Forenkle** bygger opp en bane på nytt med færre segmenter og samme form.

![En halvmåne og en ring med et ekte hull, begge laget med Trekk fra](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Resultatet er en ny bane du kan fortsette å redigere med pennen. Hull er ekte hull - en **Fyllregel**-kontroll i strøkpanelet avgjør om overlappende konturer fylles (*non-zero*) eller stanses ut (*even-odd*).

To ting gjør disse operasjonene bevisst ikke. De **nekter i stedet for å ødelegge**: be om snittet av to former som ikke overlapper, og du får beskjed om at det ikke er noe å beholde, og ingenting endres. Og tekst- og bildebokser har ingen kontur å jobbe med, så de blir stående i fred i stedet for å bli tilnærmet av rammen sin. Et kombinert resultat lagres som vanlige Bezier-kurver, slik et tegneprogram også gjør - den opprinnelige splinetypen overlever ikke operasjonen.

## Tidslinje (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** legger *tid* til det frie canvaset. Hver boks kan starte på et gitt tidspunkt, vare en viss lengde og animeres inn og ut, og en tidslinje forankret under tegnebrettet er der du ordner dem. Åpne det, og en sekvens spiller allerede - et tittelkort, et klipp, et sluttkort, en navnestripe og en musikkbunn - så modellen er synlig før du endrer noe.

![Sequence Studios tidslinje: transporten, linjalen, et overleggsspor, den magnetiske sekvensraden med klippene og skjøtebrikkene, og Always on-stripen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Det finnes to slags rader, og forskjellen er hele poenget:

- **Sekvensraden** er *magnetisk*. Klippene ligger uten mellomrom, ett etter ett, og å dra ett omorganiserer rekken i stedet for å etterlate et hull. Slett et klipp, så lukker resten seg. Dette er ryggraden din.
- **Overleggssporene** er frie. En navnestripe, en logo, en tekstplakat - alt som flyter over ryggraden på sin egen tid - får sitt eget spor og sin egen start.
- Under dem samler **Alltid på** boksene som ikke har noen tidsangivelse i det hele tatt: kulisser som rett og slett er der hele veien. `+` på en brikke løfter én opp på et spor; **Gjør alltid på** sender den tilbake.

![Redigeringsscenen: arbeidsflaten i front og sentrum, verktøylinjen til venstre og zoom-HUD-en i hjørnet](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Å åpne tidslinjen gir den tastaturet, så mellomromstasten og piltastene styrer avspillingsposisjonen i stedet for siden - og fordi den åpner seg selv på en komposisjon som allerede har tidsangivelser, gjelder det fra det øyeblikket Sequence Studio lastes.

> **[Sekvenseditoren](/info/sequence-editor.html)** går dypere inn i de fire tingene som avgjør om redigering i tid føles forutsigbar: hvilket klipp et klikk på canvaset redigerer, gjennomskinnelige skygger av naboklippene, hva en deling omfatter og Slå sammen som opphever et kutt, og trimming (inkludert tastatursettet). Trykk `?` med tidslinjen i fokus for hurtigtastarket.

**Redigering.** Dra midten av et klipp for å flytte eller omorganisere det, dra innenfor noen få piksler fra en av endene for å trimme det, og trykk **Del ved avspillingsposisjonen** (eller `S`) for å kutte ett klipp i to. Deling krever et klipp med en reell **Lengde** og avspillingsposisjonen et stykke inni det, så et åpent klipp (musikkbunnen, for eksempel) kan ikke deles. **Fest til kanter** er på som standard og fester til klippkanter, avspillingsposisjonen og hele sekunder, med Alt for å overstyre. Hver draging er ett angretrinn, og forhåndsvisningen under dragingen bruker samme regnestykke som selve endringen, så det du ser mens du drar, er det du får.

Velg et klipp, så gir inspektøren deg de samme endringene som tall: **Lengde**, **Trim inn** (hvor langt inn i kilden det starter), **Hastighet** som et sett faste multiplikatorer fra ×0,25 til ×4, **Animer inn** / **Animer ut** med lengdene sine og **Demp klipp**. Et klipp på den magnetiske raden har med vilje ikke noe **Start**-felt - raden eier rekkefølgen, så du drar for å flytte det.

**Overganger** er forhåndsinnstillinger, ikke nøkkelbilder: Ton, Sprett, Utvid, Stigning, Fall, de fire Skyv-variantene, Zoom inn og ut, Vipp, Sveip, Spinn, Drift eller **Kutt (ingen animasjon)**. Avstandene skalerer med objektet, så den samme forhåndsinnstillingen leses riktig på et helsides kort og på et lite merke. Mellom to naboklipp på sekvensraden ligger en **skjøtebrikke**: klikk den og velg **Kutt** eller **Krysstoning**, som trer i kraft med én gang og lukker seg. Åpne den samme brikken igjen for å endre **Lengde (ms)** og trykk **Ferdig**. En krysstoning lagres som en uttoning av det ene og en inntoning av det neste, og eksporten utleder selve overtoningen fra det paret - derfor ser en krysstoning ut som to toninger i forhåndsvisningen og som en ekte overlevering i filen.

**Lyd.** Legg til et **Lyd**-klipp, og det lever på tidslinjen som ethvert annet klipp: bølgeform, trimming, demping. (Den genererte bunnen standardøkten kommer med er det ene unntaket - den syntetiseres ved eksport, så stolpen forblir enkel og stum til du rendrer.) Trykk på mikrofonen for å **ta opp en fortellerstemme** rett på tidslinjen, med nedtelling og nivåmåler, og opptaket lagres som din egen ressurs på det punktet du startet. Trykk på kameraet ved siden av for å **ta opp en video** på samme måte: opptaket beskjæres til tegnebrettets eksportstørrelse mens det spilles inn, slik at den lille selvvisningen viser nøyaktig det som havner i sekvensen ved avspillingshodet, i full ramme - måten å hente en kollegas klipp fra en delt lenke på. Musikk, dialog og et klipps egen lyd når alle fram til den eksporterte miksen. (Eksportpanelets **Lydspor** er noe annet: én bunn lagt under hele klippet, med toning og ducking. De to lever side om side.)

**Rendre det.** En bevegelseseksport er en **deterministisk sammensetning**, ikke et skjermopptak - hver ramme dekodes, tegnes og kodes på et nøyaktig tidspunkt, så filen avhenger ikke av at maskinen din henger med, og det finnes ingen praktisk øvre grense for antall rammer i MP4 eller WebM. Tidslinjens egen lengde setter varigheten med mindre du skriver inn en. Content Credentials stemples som ved enhver annen eksport. En stillbildeeksport gir deg rammen ved avspillingsposisjonen, eller et helt kontaktark fra feltet **Rammer** ved siden av utdatastørrelsen - se [Eksportere](/info/exporting.html#stills-from-a-timed-composition).

Noen grenser å ha i bakhodet: en sekvens er begrenset til én time, GIF og animert PNG bufrer rammene sine og holder seg derfor korte, lyden er stum på et klipp med en annen hastighet enn ×1 (det finnes ingen tidsstrekking ennå), og **Ta opp live** er skjult her fordi sammensetteren er den bedre veien.

**Utover forhåndsinnstillinger: nøkkelbilder, dybde og et kamera.** En overgang animerer et klipp idet det ankommer og forlater. For å posisjonere en boks *inni* et klipp - la den drive, tone den, uskarpgjøre den, løfte den av siden og sette den ned igjen - legg til nøkkelbilder: velg klippet, trykk **+Nøkkelbilde** (diamanten i tidslinjens verktøyklynge, diamanten på lerretets objektlinje eller `K`), og avspillingshodets posisjon avgjør hvilken positur den neste redigeringen din skriver. Det samme nøkkelbildesystemet gir hver tidsstyrte komposisjon et **kamera** som kjører inn, panorerer over og trekker fokus, og gjør ett flatt SVG-bilde om til en stabel med lag du kan fly mellom. **[Animasjon](/info/animating.html)** er den fullstendige guiden.

Design-verktøyet har den samme tidslinjen, så du kan tidsette en layout uten å bytte verktøy, og det eksporterer bevegelse også.

## Presentere

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Et Design-dokument som består av **tegnebrett** er allerede en presentasjon. Åpne **Lolly-menyen** på verktøylinjen og velg **Presenter** - den siste raden - så blir hvert tegnebrett et lysbilde i fullskjerm, i den rekkefølgen tegnebrettene ligger på canvaset. Presentasjonen kjører på en kopi av de rendrede tegnebrettene, så editoren under røres aldri, og går du ut, er du tilbake nøyaktig der du var.

- **Advance** med **Space**, `→`, **Page Down** eller et klikk på stripen ved høyre kant av skjermen; gå tilbake med `←`, **Page Up** eller stripen ved venstre kant. **Home** og **End** hopper til første og siste lysbilde. En liten kontrollbar toner inn hver gang du beveger pekeren, og skjuler seg selv igjen når du stopper.
- **Overview** (`O` eller rutenettknappen) legger ut hvert tegnebrett samtidig i rekkefølgen du ga dem på canvasen; klikk på ett for å åpne det.
- **Reveal steps.** Høyreklikk på en boks og velg **Reveal at step 1**, **2** eller **3** i stedet for standarden **Always visible**. Den boksen venter da til du går videre til sitt trinn, slik at et lysbilde kan komme i deler; bokser som deler et tall, kommer sammen.
- **Speaker view** (`S`) åpner et andre vindu med gjeldende lysbilde, det neste som kommer, notatene dine for det lysbildet og en løpende klokke. Hvis nettleseren blokkerer sprettoppvinduet, faller det tilbake til et panel over presentasjonen. Notater angis per tegnebrett og vises aldri på selve lysbildet.
- `B` holder en svart skjerm (en hvilken som helst tast bringer lysbildet tilbake), `F` går tilbake til fullskjerm, og **Escape** skreller av ett lag om gangen: fra oversikten tilbake til presentasjonen, fra presentasjonen tilbake til redigeringsverktøyet.
- **Kiosk.** Gi et tegnebrett en **Length**, så holder presentasjonen seg der like lenge, og går deretter videre av seg selv bak en tynn fremdriftslinje; `K` (eller pauseknappen, som bare vises når noe har en lengde) stopper og starter den på nytt. Legg til `kiosk` i lenken, så løper presentasjonen i loop på slutten, og det er det som gjør den til digital skilting.

Presentasjonen er også en lenke. `?present` åpner rett inn i den, `s=` navngir lysbildet - en posisjon, en tegnebrett-id eller `id.step` for et byggetrinn - og adressen oppdateres mens du beveger deg, så det du sender er lysbildet du står på. Verktøyforfattere: de parameterne er dokumentert på siden [URL-modus](/info/url-mode.html#reserved-parameters).

## På en telefon

På smale skjermer flyter layouten om til én kolonne:

- **Kontrollene blir et ark** øverst med et **draghåndtak** på nedre kant. Dra håndtaket for å endre størrelsen - det fester seg til **kikk / halv / full** - eller **trykk** på håndtaket for å veksle mellom sammenslått ↔ utvidet. Forhåndsvisningen fyller plassen under og forblir synlig mens du redigerer.
- En flytende **Eksporter**-knapp åpner eksportarket - alle kontrollene for format, størrelse, kopiering, lagring og nedlasting på ett sted. Lukk det ved å trykke på bakgrunnen.

![Et verktøy på en telefonbred skjerm - kontrollene som et ark øverst, den genererte paletten som fyller forhåndsvisningen under og renderpillen som flyter nederst i midten](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Kontroller (felter)

Verktøy viser bare de feltene som er ment å variere - alt annet (farger, layout, typografi, logikk) er låst av verktøyforfatteren, så det du lager oppfyller reglene forfatteren satte. Feltene omfatter tekst, glidebrytere, fargevelgere, nedtrekksmenyer, datoer, bildevelgere og gjentakende radgrupper. Noen er samlet under sammenleggbare seksjoner.

![Et verktøys kontrollstabel - et tekstfelt, fargeknapper og en glidebryter, og ingenting annet, siden forfatteren låste resten](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Tilbakestilling:** *Fjern endringer* setter hvert felt tilbake til standardverdien.

### Angre og gjøre om

**Cmd/Ctrl-Z** går et steg tilbake og **Cmd/Ctrl-Shift-Z** (eller **Cmd/Ctrl-Y**) går fram igjen. Det samme paret ligger som knappene **Angre** og **Gjør om** i raden over kontrollene - på det frie canvaset ligger de på verktøylinjen i stedet - og hver av dem blir grå når det ikke er mer å ta tilbake. Hvert steg sier hva det var: angrer du en farge, navngir en liten melding feltet den nettopp gjenopprettet, med en **Gjør om**-knapp i seg for veien tilbake.

- **En draging er ett steg.** Gjentatte endringer på den samme kontrollen innenfor et halvt sekund slås sammen, så det å dra en glidebryter gjennom hele skalaen er én angring i stedet for to hundre.
- **De siste 100 stegene beholdes** - eldre faller av. Gjør du en ny endring etter å ha angret, tømmes stabelen framover, slik den gjør overalt ellers.
- **Mens markøren står i et tekstfelt** tilhører Cmd/Ctrl-Z feltet selv, tegn for tegn. Lolly tar over for de kontrollene som ikke har noen nyttig angring selv: glidebrytere, nedtrekksmenyer, farger og brytere.
- **Å velge en fil** i et **fil**-felt er ikke et steg - de bytene holdes bare for økten, så det ville ikke være noe å legge tilbake.

I et [samarbeid](/info/collaborate.html) i sanntid forblir historikken din alene. En endring som kommer fra den andre enheten, havner aldri på din stabel, så angre kan bare noensinne reversere noe du selv gjorde.

## Opplysningene og portrettbildet ditt

**Profil** (øverst til høyre i galleriet) inneholder navnet ditt, kontaktopplysninger og et valgfritt **portrettbilde**. Verktøy som spør etter de feltene, fyller dem ut automatisk - sett dem én gang, så fyller e-signaturen, logolockupene og merkene seg ut selv. Du kan fortsatt overstyre et felt per økt. Slå på **Bruk mine opplysninger til å opprette**, så følger opplysningene dine med som forfatter på det du eksporterer.

Portrettbildet og opplysningene dine ligger **bare på denne enheten**. En profil kan være mer enn bare deg - et team eller en rolle du går inn i nå og da. Se **[Profiler](/info/profile.html)** for hele bildet, inkludert det å ha flere enn én.

## Lagre og fortsette

Klikk **Lagre** for å lagre de gjeldende verdiene som en økt for det verktøyet. Du kan ha flere navngitte økter per verktøy; hvert verktøys **Fortsett**-knapp åpner den siste igjen, og **historikk-knappen** (øverst til høyre, ved siden av profilen din) lister opp hver lagrede økt på tvers av alle verktøy. Økter er lokale på enheten. For å ordne dem åpner du **Prosjekter** (nedenfor).

![Renderpillen med to halvdeler - en pil opp som åpner eksportpanelet, og en hake som lagrer økten der den er](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Prosjekter

**Prosjekter** - åpne det fra fanen **Prosjekter** ved siden av **Verktøy**, eller fra **Profil → Lagring → Ordne i Prosjekter** - er et hjem for alt du har lagret, og det fungerer som en filbehandler:

![Prosjekter - lagrede økter ordnet i mapper som kan ligge inni hverandre](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Mapper inni mapper.** Samle lagrede økter i mapper, og mapper inni mapper, så dypt du vil. Opprett en mappe, gi den nytt navn eller dra en flis over på en annen mappe for å flytte den; en brødsmulesti fører deg opp igjen. En mappe **Ukategorisert** er alltid til stede og holder på alt som ikke er sortert ennå.
- <!--i:clock--> **Sorter på din egen måte.** **Vis og sorter** tilbyr **Navn**, **Dato lagt til**, **Sist endret** (standardvalget) og, inne i en mappe, **Etter verktøy**. Mapper kommer alltid først uansett hvilken sortering som er aktiv - sorteringen ordner bare øktene og mappene innenfor sin egen gruppe.
- <!--i:document--> **Legg nytt arbeid rett inn.** **Ny ressurs** («Start en ny kreasjon» på rotnivå, «Legg til i *mappe*» inne i en) åpner et verktøy og legger den første lagringen i den mappen automatisk.
- <!--i:checklist--> **Flervalg (skrivebord).** Kryss av en flis' avkrysningsboks, dra en markeringsramme over tomt område eller **Shift/Cmd-klikk**; **høyreklikk** en flis for kontekstmenyen. Så handler du på hele utvalget på én gang - den samme bevegelsen og den samme flytende handlingslinjen virker i verktøygalleriet, Hjelpeverktøy, Katalogen og Prosjekter, ikke bare her.
- <!--i:download--> **Rendre en hel mappe eller et utvalg.** **Rendre mappe** eksporterer hver lagrede økt i en mappe - inkludert undermappene - som én nøstet `.zip`. **Rendre utvalg** gjør det samme for et hvilket som helst flervalg, og en enkelt økt rendres rett til sin egen fil. Du trenger ikke Batch/Pro.
- <!--i:link--> **Hopp rett til et verktøys lagrede arbeid.** Kryss av ett eller flere verktøy i verktøygalleriet og velg **Vis økter** fra utvalgslinjen - Prosjekter åpnes og viser bare øktene som er laget med de verktøyene, med en **Fjern** for å komme tilbake til full visning.
- <!--i:link--> **Del en lagret økt.** Høyreklikk en økt → **Del lenke** for å kopiere en lenke som åpner den igjen med nøyaktig de samme verdiene (hele delingsdialogen - se nedenfor).

![Popoveren Vis og sorter åpen i Prosjekter, med en temarad, et valg mellom Forhåndsvisning eller Liste under Vis, og Navn, Dato lagt til og Sist endret under Sorter](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

**Hva utvalgslinjen tilbyr** varierer litt fra visning til visning, siden ikke alle handlinger gir mening overalt:

- **Verktøy / Hjelpeverktøy:** Favoritt (eller Fjern favoritt), Skjul (eller Vis igjen), Tilgjengelig offline (eller Fjern fra offline), **Vis økter** (hoppet beskrevet over) og Kopier lenke når nøyaktig ett kort er valgt.
- **Katalog:** Favoritt og Skjul gjelder for et hvilket som helst utvalg; Dupliser, Last ned og Slett dukker først opp når hvert valgte element er en av dine egne opplastinger - en delt designsystemressurs er en permanent kontrakt, så de tre holder seg unna den også i bulk.
- **Prosjekter:** **Rendre utvalg**, **Flytt til…**, **Ny mappe**, **Slett**, **Rediger sammen** når utvalget er mellom to og åtte økter fra ett og samme verktøy (det åpner dem side om side under ett felles sidepanel) og **Rediger som ark**, som i stedet åpner hele utvalget som rader i batch-rutenettet. Det siste har **ingen størrelsesgrense** og bryr seg ikke om øktene kom fra samme verktøy, så det er nødutgangen når et utvalg er større eller mer blandet enn de to til åtte i Rediger sammen.

> En felle i merkingen: **Vis økter** finnes bare når noe er *valgt*. Høyreklikker du et enkelt kort som ikke er valgt, får du i stedet **N lagrede økter**, som åpner verktøyets egen historikkdialog i stedet for å navigere til Prosjekter.

![To verktøykort haket av i Verktøy-galleriet, med den flytende valglinjen som viser 2 valgt og tilbyr Tilgjengelig offline, Vis økter, Favoritt og Skjul](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
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


## Dele arbeidet ditt

Et design går ut på én av to måter: som en lenke eller som en fil. Delingsdialogen tilbyr begge. Åpne den med **Del** i eksportkontrollene; **Del lenke** på en lagret økt i Prosjekter åpner den samme dialogen for den økten.

### Lenken

Hvert felt fanges opp i side-URL-en, så en lenke *er* designet. Øverst i dialogen ligger lenken klar til kopiering, med to sammenslåtte seksjoner under.

- **Lenkevalg** inneholder **Korteste lenke** (et stort design gir en lang URL, så dette pakker hele tilstanden inn i et kompakt token og viser deg besparelsen i tegn; den lesbare formen er alltid der også), **Passordbeskytt denne lenken** (AES-256 over hele lenken, passordet aldri i den) og **Lås til denne verktøyversjonen** - flagget `_v`, som fester lenken til den verktøyversjonen du ser på, slik at en senere oppdatering ikke kan endre det den rendrer.
- **Lenkeoppførsel** er hva som skjer når mottakeren åpner den: fullskjerm, eksportpanelet allerede utvidet, nedlasting ved åpning med `&export` eller kopiering til utklippstavlen med `&copy`.

Lim lenken inn til en kollega, bokmerk den eller sjekk den inn i koden. (Alle detaljer: [URL-modus](/info/url-mode.html).)

**Noen verktøy gjør lenken til hele produktet.** Jump Page samler lenkene dine på én side å dele ut - en bio-lenke, et konferanseforedrag, en butikkfront. Det er ingenting å hoste og ingen konto bak det: siden er lenken, så den åpner like raskt som URL-en reiser. I redigeringsverktøyet ser du den ferdige siden ved siden av feltene; en besøkende som åpner lenken, får den i full bredde, én lenke per scene etter hvert som de ruller.

![Jump Page i redigeringsverktøyet - overskriften, tre lenkescener hver med sin egen fargevask og en Made with Lolly-footer, lagt ut som én side på lerretet](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Dialogen sier hva en lenke ikke kan bære.** Tre ting får ikke plass i en URL: et bilde eller en fil du la til fra denne enheten, en svært lang tekstverdi eller en svært stor liste. Hver av dem telles mens lenken bygges. Måtte noe utelates, navngir dialogen det og peker deg til filen nedenfor, i stedet for å gi deg en lenke som åpnes uten bildet. En lenke som bare er *lang*, får en mildere merknad med antall tegn, siden pakking fortsatt kan redde lengden.

### .lolly-filen

**Last ned .lolly**, i delingsdialogen i verktøyet du jobber i, skriver det samme designet som en fil. Den bærer med seg den lagrede økten sammen med bildene og filene du la til fra enheten din. Katalogmateriellet designet bygger på, følger med inni den også, så filen åpnes komplett på en maskin som aldri har sett merkevaren din. Har enheten din et delingsark, gir **Send til…** filen rett videre dit (AirDrop, en Android-deling) i stedet for å lagre den på disk.

En `.lolly` er en helt vanlig zip. Gi den navnet `.zip` og åpne den: dine egne bilder ligger under `assets/uploads/` og katalogmateriell under `assets/catalog/`, hver med sitt virkelige navn og filendelse, `manifest.json` lister opp hver enkelt, og en README øverst forteller hva filen er.

Tre ting bestemmer du før den går:

- **Om navnet ditt tas med.** Navnet, e-posten og organisasjonen din skrives inn i filen bare når **Use my details to create** er på i profilen din. Med den av, registrerer filen bare at den ble laget med Lolly og når - ingenting om deg.
- **Om lisensiert grafikk tas med.** Lisensierte og merkevarelåste ressurser holdes tilbake som standard. Hvis designet bruker noen, forteller dialogen hvor mange, og tilbyr to knapper - *Download without them* eller *Include and download* - fordi å inkludere dem gir de faktiske filene til den som åpner `.lolly`-filen.
- **Om verktøyet tas med.** **Include the tool** pakker verktøyets egne filer sammen med designet, slik at det åpnes på en enhet som ikke har det verktøyet. Den kommer forhåndsavkrysset for et tilpasset verktøy - en fork eller et privat merkevareverktøy mottakeren neppe har - og ikke avkrysset for et verktøy den signerte katalogen lister opp, siden deres kopi kommer fra samme kilde. (På en build uten signert katalog telles alle verktøy som tilpassede, og boksen starter avkrysset.)

**Å åpne en.** Slipp en `.lolly` på appen: ressursene går til biblioteket ditt, økten går til Prosjekter, og verktøyet åpner på den. Ingenting av ditt overskrives: økten ankommer som en ny lagret plass, mens en ressurs som allerede finnes på denne enheten, matches via sjekksum og gjenbrukes i stedet for duplisert. Hver del sjekkes mot filens egne sjekksummer på vei inn, slik at en kopi skadet under overføring avvises i stedet for halvveis importert.

Bærer filen med seg et verktøy du ikke har, spør Lolly før det verktøyet kan kjøre: **Stole på dette verktøyet?** navngir det og forfatteren og sier rett ut at å åpne det kjører verktøyets egen kode på enheten din, med **Stol på og installer** som veien videre. Sier du nei, blir det delte arbeidet likevel lagret i prosjektene dine, og venter der til den dagen du legger til verktøyet. (Én type verktøy kan ikke sidelastes ennå - et der koden leveres som en modul - og det avvises på samme måte.)

Både en lenke og en fil gir fra seg et øyeblikksbilde. Vil du jobbe på den samme økten *samtidig* som en annen - to enheter, ingen server, ingen internettforbindelse nødvendig hvis dere er på samme nettverk - se [Jobbe sammen](/info/collaborate.html).

## Direkte kamera (bevegelsesreaktive verktøy)

Hvert **Filter** for foto - Halftone, Scanline, Posterize, Voronoi-celler, Fargebehandling, Pikselstrekk og Ujevnheter - viser en **Gå live**-knapp der et kamera er tilgjengelig. Slå den på, så følger effekten webkameraet ditt ramme for ramme, slik at den reagerer på bevegelse; du kan ta opp resultatet til GIF, WebM eller MP4. Rammene leses og behandles **på enheten din** og forlater den aldri, og kameraet frigis i det øyeblikket du stopper eller forlater verktøyet. (Enhver bildevelger har også **Ta et bilde** for å fange én enkelt ramme som et bilde på enheten.)

## Mine bilder

Når et verktøy lar deg legge til et bilde fra enheten din, beholdes det nøyaktig slik det kom inn - så en Content Credential på det verifiseres fortsatt - og lagres i ditt personlige bibliotek **Mine bilder** (under **Profil → Lagring**). Bare en virkelig enorm fil spør om du vil beholde den eller endre størrelsen. Gjenbruk den i et hvilket som helst verktøy. For å fjerne EXIF/GPS mens bildene kommer inn slår du på **Fjern metadata fra opplastinger** i profilen din. Det finnes ingen grense: biblioteket er helt lokalt og begrenses bare av lagringsplassen på enheten din - der administrerer eller sletter du bilder.

## Katalogen - ressursbiblioteket ditt

**Katalogen** (`#/c`, eller segmentet **Katalog** i bryteren Prosjekter · Verktøy · Hjelpeverktøy · Katalog øverst i hver oversiktsvisning) samler alt verktøyene dine kan bygge på - merkevarelogoer, bilder, lyd og bevegelse, gruppert etter type - og det er også der dine **egne kreative filer** ligger. Ingen server, ingen adminkonsoll, ingen pull request: alt ligger på enheten din.

![Katalogen - merkevareressurser, fargeprøver og skrifter, pluss dine egne opplastinger](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Ta med filene dine inn.** Dra et hvilket som helst bilde, SVG, lydklipp, video, Lottie, PDF eller PowerPoint-presentasjon inn på opplastingsområdet - eller klikk for å velge - og det havner i katalogen din øyeblikkelig, klart i hvert verktøys ressursvelger. En flersides PDF eller en `.pptx` spør hvilke sider eller lysbilder som skal beholdes - hver blir en SVG-ressurs. Ta inn så mye du vil; det forlater aldri enheten din.
- <!--i:star--> **Favoritt-merk det du bruker ofte.** ★ en ressurs (eller en merkevarefarge) og den festes øverst i hver velger, slik at logoen eller fargen du bruker mest, er ett klikk unna.
- <!--i:folder--> **Rydd opp.** Omkategoriser en ressurs til en annen gruppe, skjul en delt merkevareressurs du ikke bruker (med **Vis skjulte** for å hente den tilbake), eller slett dine egne opplastinger for godt. Samme flervalgsgest og flytende handlingslinje som i Prosjekter fungerer her også, slik at alt dette kan gjøres på et helt utvalg samtidig.
- <!--i:layers--> **Løft en video av bakgrunnen dens.** Åpne en videos detaljvisning eller høyreklikk kortet dens i en hvilken som helst ressursvelger, og velg **Fjern bakgrunn…** for å lagre et transparent alternativ - en animert WebP eller PNG med ekte alfa. Velg en **Metode**: en **modell på enheten** klipper et motiv ut av en travel scene, eller en **fargenøkkel** nøkler ut en jevnt belyst, flat bakgrunn som en grønnskjerm eller en enkel vegg, med **Toleranse**, **Mykhet** og **Fargelekkasjefjerning** for å finjustere kanten. Fargenøkkelen trenger ingen modellnedlasting og ingen nettverkstilgang, så **Fjern bakgrunn** tilbys på enhver video og er ofte renere på ryddig opptak. En **Oppløsning**-kontroll (360, 480, 720 eller 1080p, aldri forbi kilden) bytter detaljer mot en mindre, raskere fil. Den kjører som en bakgrunnsjobb på enheten din. Det ferdige utklippet lagres ved siden av originalen som sin egen ressurs, og kildevideoens Content Credential blir med som en ingrediens. (Se [Generert én gang, rendret likt](/info/ai-features.html) for hvorfor det å fjerne en bakgrunn forblir en enkel redigering.)

### Ta paletten og skriftene dine med overalt

Katalogens panel **Fargeprøver** gjør mer enn å vise fram - klikk på en farge for å kopiere den, eller **last ned hele merkevarepaletten** i det formatet det andre verktøyet ditt snakker:

- <!--i:code--> **Designtokens (JSON)**, **CSS-variabler** eller **CSS-klasser** - slipp merkevaren rett inn i et stilark eller et bygg;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - last den inn i Illustrator eller Photoshop;
- <!--i:pentool--> **GIMP-palett (.gpl)** - for GIMP eller Inkscape.

![Panelet Fargeprøver - de fem nedlastingsknappene for paletten øverst, deretter hver merkevarefarge som en kopierbar brikke](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Panelet **Skrifter** lister opp merkevareskriftene dine med en **nedlasting** ved siden av hver, til å installere lokalt eller gi til et trykkeri. (Fargerommet i [Brand Studio](/info/brand-studio.html) tilbyr den samme palettnedlastingen.)

Ressurser er den ene halvdelen av den åpne gjør-det-selv-veien; den andre er å **lage dine egne verktøy** - det frie canvaset (Design, beskrevet over) lar deg bygge ett visuelt, uten kode.

## Lyd og tilgjengelighet

Lolly skal være behagelig å bruke for alle. Grensesnittet kan navigeres med tastatur, egendefinerte kontroller har ordentlige merkelapper for skjermlesere, og hvert verktøys levende forhåndsvisning eksponeres som ett merket bilde som beskriver hva det lager.

Et forsiktig lag med **hjelpelyder** bekrefter det du gjør - at du kommer inn i galleriet, en gyldig eller ugyldig Content Credentials-sjekk, at et panel lukkes, at et filter byttes. Det er **av som standard**: slå på **Lyd** der bryteren dukker opp (hver visnings valgpopover, eller **Profil**), så huskes valget.

Fire komfortinnstillinger du selv slår på ligger under **Profil → Tilgjengelighet**: **Reduser bevegelse** (fjerner appens overganger og krusiduller), **Skjul fargerike forhåndsvisninger** (rolige gallerikort med ikon og tekst, og dempede prosjektminiatyrer), **Høy kontrast** (sterkere kanter, tekst og fokusringer) og **Stor tekst** (større skrift i appen - merkelapper, menyer, knappetekst). Alle fire roer appen *rundt* arbeidet ditt: de når aldri inn i et verktøycanvas og endrer ikke en piksel av det du eksporterer, og hver av dem er av til du slår den på. Alle detaljer i [Profilen din → Tilgjengelighet](/info/profile.html#accessibility).

Ved siden av Lyd-bryteren ligger **Neurospicy-modus** - et valgfritt, beroligende bakgrunnsspor som spiller lavt mens du jobber. Slår du det på, åpnes en liten **spillerdokk** i nedre hjørne som følger deg gjennom appen; derfra kan du søke og velge et spor, hoppe fram og tilbake, stille volumet og minimere eller lukke den. Sporlisten spenner over noen få kategorier - prosedyrelagde *Lolly Sings*-melodier, ambiente løkker og beats, din egen opplastede lyd og en håndfull direktesendte **radiostasjoner** på nett (disse krever forbindelse; alt annet spilles av offline). Den er **av som standard** og huskes, som Lyd, på tvers av økter og enheter. Slår du av Lyd, dempes fokussporet også.

## Lagring og personvern

Alt lagres i nettleserens lokale database (IndexedDB): profilen din, lagrede økter, opplastede bilder og en cache med nedlastet kataloginnhold. **Profil → Lagring** viser bruken og lar deg:

- <!--i:box--> **Tøm cache** - kast nedlastet kataloginnhold (synkroniseres på nytt ved neste lasting).
- <!--i:trash--> **Slett alle mine data** - slett profil, økter og bilder. *Kan ikke angres.*

![Lagringskortet på en telefonbred skjerm: hver kategori av data på enheten navngitt, med knappen Slett alle mine data nederst](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Ingen av disse lokale dataene sendes noe sted - ingen telemetri, ingen skyrendering. Den komplette listen over hva appen noen gang henter eller sender finnes i [Personvernerklæringen](/info/privacy.html), og [Serverflate](/info/server-surface.html) går gjennom de valgfrie serverkomponentene.

## Flytte til en annen enhet

Fordi alt ligger på enheten din, lar **Profil → Lagring → Flytt til en annen enhet** deg ta med alt til en installasjon nummer to - ingen konto, ingen sky:

- <!--i:download--> **Eksporter dataene mine** laster ned én enkelt `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (navnedelene kommer fra profilen din og utelates hvis de ikke er satt; `<n>` er en teller per dag, så eksporter samme dag ikke kolliderer) som inneholder profilen din, hver lagrede økt (med miniatyrbildet), de opplastede bildene dine og innstillingene dine (tema, sidepanelbredde, lokal aktivitetsstatistikk).
- <!--i:upload--> **Importer data…** på den andre installasjonen leser den filen inn igjen. Den **fletter**: alt med samme navn (profilen din, en øktplass, et bilde) erstattes av den importerte kopien; alt annet på den enheten beholdes. Lagrede økter kobles automatisk på nytt til de importerte bildene dine.

Katalog-cachen er ikke med - den laster seg ned på nytt på den nye enheten. Pakken er en helt vanlig zip (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, format-id `lolly-backup`), så den overlever e-post, USB eller AirDrop intakt og er det samme formatet hvert skall leser. Hver del har sjekksum, så en fil som er skadet underveis fanges opp ved import i stedet for å bli gjenopprettet halvveis ødelagt. (Full formatspesifikasjon: [Dataoverføring](/info/data-transfer.html).)

## Importere et design (Figma, Penpot, Illustrator, InDesign)

Du kan ta et eksisterende design inn i Lolly og jobbe videre med det: åpne **Design**, klikk **Importer et design** i canvasets verktøylinje, og velg en Figma-**.fig** eller SVG, en Penpot-**.penpot**, en Illustrator-**.ai** / **.pdf** eller en InDesign-**.idml**. Lagene blir redigerbare bokser på det frie canvaset - teksten kan fortsatt skrives om, bilder havner i **Mine bilder**, og skrift og farger retter seg etter merkevarens globale verdier - og resultatet lagres, deles og rendres som enhver annen økt. Analysen skjer i sin helhet på enheten din. Alle detaljer: **[Importere et design](/info/design-import.html)**.

## Eksportere

Se **[Eksport og formater](/info/exporting.html)** for hele historien - å velge format, utdatastørrelse og trykkenheter, gjennomsiktighet, video og kopiering/deling. Kort sagt: velg et format, sett størrelsen om du trenger det og **Last ned** (eller **Kopier** til utklippstavlen).

## Batch-modus (Pro)

For avanserte brukere rendrer **Batch** (lenket fra galleriet, bak Pro-funksjonsflagget, som er på som standard) mange varianter på én gang - et rutenett der hver rad er et sett med verdier, eksportert samlet. Ideelt for å lokalisere et kort til et dusin språk eller lage alle størrelsesvarianter i én omgang. Fyll radene ved å skrive, lime rett inn fra et regneark eller importere en CSV (du kan eksportere en tilbake også), og sett format, størrelse og filnavn per rad. Lagre et helt rutenett som en navngitt **batch-økt** som åpnes igjen fra galleriet, og last ned hver rad som én enkelt `.zip`.

![Batch-verktøylinjen - zip-navn, enheter, DPI og formatet hver rad arver, med Økter og Rendre til høyre](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch er til å lage **mange varianter av én mal** på én gang. For å rendre økter du **allerede har lagret** på nytt, bruk **Prosjekter → Rendre mappe / Rendre utvalg** (over) - du trenger ikke Pro.

## Redigere side om side (Multiredigering)

Batch er mange varianter av *ett* design. **Multi-edit** er den andre halvparten av jobben: flere **forskjellige** lagrede design åpne samtidig, slik at én endring gjelder for alle sammen. Hak av mellom **to og åtte** lagrede økter i **Prosjekter** og velg **Rediger sammen** fra valglinjen; de åpnes som levende kort side om side på `#/multi?s=<slot>,<slot>…`. Hvert kort er en ekte rendring av den økten, ikke et lagret miniatyrbilde, så det du ser, er det som vil eksporteres.

Ett sidepanel styrer hele settet:

- <!--i:sliders--> **Delt** står først - hvert felt som to eller flere av de valgte øktene erklærer *på samme måte* (samme id, samme type, samme begrensninger - den samme flettereglen batch-rutenettet bruker på kolonnene sine). Endre en delt kontroll én gang, så sprer verdien seg til hver økt som erklærer den, direkte på hvert kort. To økter fra samme verktøy deler alt; to forskjellige verktøy deler det de tilfeldigvis har felles, og ingenting mer.
- <!--i:document--> Under det ligger **ett sammenslått kort per økt** med alle den øktens egne felter, like fullstendig som verktøyets eget sidepanel - ressursvelgere, gjentakende radgrupper, fargefelter - pluss en kompakt eksportblokk: **Format**, **B** / **H**, **Enhet**, **DPI** og sin egen **Last ned**. Den nedlastingen lagrer økten først og rendrer den så gjennom den vanlige eksportveien for økter, så filen bærer det samme filnavnet, formatet og de samme Content Credentials som den ville gjort rett fra verktøyet.
- <!--i:search--> **Filtrer felt…** øverst snevrer inn kontrollene på *alle* kortene samtidig - det er slik du kommer til «overskriften» i åtte økter uten å måtte rulle etter den.

Klikk på et canvas (eller trykk Enter på det), så åpnes den øktens kort i sidepanelet og rulles fram. **Lagre alle** skriver hver økt tilbake til sin egen plass. **Last ned alle** lagrer først og rendrer så hele settet gjennom den samme rørledningen som **Rendre utvalg** i Prosjekter - én zip, med den valgfrie passordlåsen tilbudt underveis.

To ærlige grenser. Grensen på to til åtte er reell: hvert kort starter sin egen levende kjøretid, og det er antallet som holder seg responsivt - en lenke som ber om flere (eller om en økt som ikke lenger finnes) sier fra i stedet for å laste halvveis. Og lenken navngir *dine* lagrede plasser, så den åpner det settet igjen på denne enheten; den er ikke en delingslenke.

Når utvalget er større enn åtte, blander verktøy eller inneholder bilder i tillegg til økter, er nødutgangen **Rediger som ark** i den samme utvalgslinjen: det åpner hele utvalget som **rader i batch-rutenettet** (`#/pro?s=…`), uten størrelsesgrense og uten krav om samme verktøy. Mapper holdes utenfor begge - de har sin egen vei inn i rutenettet. ([Søk](/info/search.html) er det ene som ikke når inn hit ennå: Multiredigering er den eneste visningen søkefeltet ikke kjenner til.)

## Offline og installasjon

Lolly er en PWA. Etter første lasting virker den **offline** - installer den fra nettleserens adressefelt (eller *Legg til på startskjermen* på mobil) for en app-lignende opplevelse i fullskjerm. Den oppdaterer seg selv når du er på nett igjen.

Om oppdateringer: hvis en visning noen gang ikke klarer å laste rett etter en (et tomt panel, en "failed to fetch" i hjørnet), last inn siden på nytt én gang - appen tar i bruk den nye versjonen problemfritt, og arbeidet, øktene og merkevaren din er urørt. Den lagrer alt på enheten din, ikke på siden.
