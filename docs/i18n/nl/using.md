# Lolly gebruiken

Een praktische gids voor het daadwerkelijk *gebruiken* van de app - een tool openen, werken met het canvas, exporteren, opslaan en delen. Alles hier draait **op je eigen apparaat**: geen account, geen upload, geen internet nodig na de eerste keer laden.

> Nieuw hier? [Snelstart](/info/quickstart.html) helpt je binnen enkele minuten iets te maken, en [Lolly voor operators](/info/operators.html) behandelt het installeren/uitrollen van de app; deze pagina gaat over het bedienen ervan zodra hij open staat.

## Een tool openen

Het startscherm is de **galerij** - elke tool, gegroepeerd per categorie. Klik op een kaart om de tool te openen; als je er eerder aan hebt gewerkt, hervat een **Doorgaan**-knop je meest recente sessie. Gebruik het zoekvak om op naam te filteren - of [Zoeken](/info/search.html) via de balk onderaan de zes overzichtsschermen (de galerij, Hulpprogramma's, Projecten, de Catalogus, het Dashboard en Profiel), die naast de tools ook je opgeslagen werk, de catalogus en je instellingen bereikt. Binnen een tool stapt de balk opzij voor de eigen chrome van de tool.

![De toolgalerij - elke tool als kaart, gegroepeerd per categorie](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Elke tool is een gesplitste weergave: **bedieningselementen** aan de ene kant, een live **voorvertoning** (het canvas) aan de andere. Verander een bedieningselement en de voorvertoning wordt direct bijgewerkt.

![De gesplitste weergave van een tool - de bedieningsstack links, en de live gegroepeerde staafdiagram die hij rechts tekent](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Een paar tools (zoals **Design**) openen in plaats daarvan als een **vrij canvas** - een chromeloos oppervlak voor directe manipulatie waarop je vakken met tekst, vormen en afbeeldingen sleept, van grootte verandert, roteert en laat vastklikken, en waar je dubbelklikt om tekst ter plekke te bewerken. Het exporteert via hetzelfde renderpad als elke andere tool, dus het canvas *is* het bestand. Zie [Het vrije canvas](#the-free-canvas-design) hieronder.

Twee manieren om het raster zelf naar je hand te zetten:

- <!--i:star--> **Markeer wat je gebruikt.** Geef een kaart een ★ en hij krijgt een eigen grote tegel in een strook boven het raster - zie [Je favorieten](/info/favourites.html).
- <!--i:eyeoff--> **Verberg een tool die je nooit gebruikt.** Rechtsklik op een kaart (of selecteer er meerdere en gebruik de selectiebalk) → **Tool verbergen**. Hij valt uit het raster, en uit wat typen in het raster vindt; een grijze tegel **Verborgen tools tonen (N)** helemaal aan het eind haalt ze gedimd weer tevoorschijn, elk met **Tool zichtbaar maken** in het eigen menu. Verbergen gaat alleen over jouw raster - de tool opent nog steeds vanuit een opgeslagen link of een bladwijzer, en blijft voor iedereen precies waar hij was.

![Het einde van het toolraster met de verborgen tools zichtbaar gemaakt: de gedimde kaart QR Code Generator, en ernaast de grijze tegel die hem terughaalde, nu met de tekst Verborgen tools verbergen](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

Als je liever vraagt dan zoekt: **Ask Lolly** (`#/ask`) neemt een getypte vraag aan en geeft het bijpassende deel van deze documentatie **letterlijk** terug - de eigen woorden van de gidsen, geen samenvatting en niets gegenereerds - met vermelding van de pagina waar het vandaan komt en een link **Openen in documentatie** ernaast. Onder het antwoord staan de plekken in de app waar dezelfde vraag op past: een tool, een instelling, een opgeslagen project, elk als knop die je er simpelweg naartoe brengt.

Het transcript is sessiegeheugen: stel een vervolgvraag en de draad bouwt zich al doende op, herlaad de pagina en hij begint opnieuw. Zoekresultaten dragen onderaan een rij **Ask Lolly: *jouw zoekopdracht*** - onder de concrete treffers die de andere groepen vonden - die de vraag meteen doorgeeft, zodat je in de balk kunt beginnen en hier kunt eindigen.

## Het canvas (voorvertoning)

De voorvertoning toont altijd precies wat er geëxporteerd wordt.

**Desktop**

- **Zoomen:** Cmd/Ctrl-scroll, of knijpen op een trackpad - zoomen centreert op je cursor.
- **Pannen:** houd **Spatie** ingedrukt en sleep, of sleep met de **middelste muisknop**. (Gewone klikken blijven vrij voor het klikken op onderdelen van het ontwerp.)
- **Toetsenbord:** `0` = passend in venster · `1` = 100% · `+` / `−` = zoomen.
- **Zoom-HUD:** het kleine bedieningselement `−  NN%  +  Fit` in de hoek. Klik op het percentage om te wisselen tussen Fit ↔ 100%.

![De zoom-HUD in de hoek van het canvas - min, het live percentage, plus, Fit, en dan de schakelaars voor thema en geluid](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Touch**

- **Knijp** om te zoomen, **sleep** om te pannen, **dubbeltik** om terug te zetten naar passend.

**Klik om naar een bedieningselement te springen:** klik op een willekeurig element in het ontwerp en het bijbehorende invoerveld in de zijbalk krijgt focus en scrolt in beeld - bij een herhalende rijgroep vouwt precies de rij open waarop je klikte, zodat bewerken wat je ziet één tik verwijderd is.

Een wijziging van de afmetingen zet de weergave altijd terug naar een nette passende weergave.

### Het vrije canvas (Design)

Tools met een vrij canvas voegen een werkoppervlak toe *rondom* het tekenvlak, zoals het plakbord van een ontwerper:

- **Opslag buiten het canvas.** Sleep een vak voorbij de rand van het kader en het blijft volledig **zichtbaar en selecteerbaar** - parkeer elementen aan de zijkant terwijl je de compositie samenstelt, en sleep ze later weer naar binnen. Alles buiten het kader wordt **licht vervaagd**, zodat het exportgebied altijd in één oogopslag duidelijk is, en het kader behoudt zijn schaduw om precies aan te geven waar het bestand begint.
- **Alleen het kader wordt geëxporteerd.** Het geëxporteerde bestand wordt begrensd door het tekenvlak - alles wat daarbuiten blijft (of het deel van een vak dat over de rand hangt) wordt eenvoudigweg uit de uitvoer weggesneden, zowel in raster- als vectorformaten.
- **Zoom verder uit dan Fit** (tot 20%) om het hele plakbord te zien wanneer je dingen ver buiten het kader hebt geplaatst.
- **Verstelbaar tekenvlak.** Het wijzigen van de exportafmetingen verandert de grootte van het kader ter plekke; vakken behouden hun positie, zodat je een layout opnieuw kunt kaderen rond bestaande inhoud.

![Het vrije canvas van Design - het artboard met het omringende plakbord](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Een selectie spiegelen.** Klik met de rechtermuisknop op een box en kies **Horizontaal spiegelen** of **Verticaal spiegelen** om hem ter plekke te spiegelen, of druk op `Shift+H` / `Shift+V` op het toetsenbord - Shift, omdat een kale `V` de Pointer-tool is. Elke geselecteerde box spiegelt op zijn eigen as in één undo-stap, en de spiegeling is een echte transform, dus die blijft staan in de geëxporteerde SVG, PDF en PNG en niet alleen op het canvas.

### Je eigen vormen tekenen (de pen)

Vakken, cirkels en afgeronde kaders dekken de meeste layouts. Heb je een vorm nodig die niet in dat rijtje staat, teken hem dan: de knop **Pen** op de balk (of de toets `P`) zet je in tekenmodus. Drie losse toetsen wisselen tussen de modi - **`V`** terug naar de Pointer, **`P`** voor de Pen, **`N`** voor het puntgereedschap (**Punten bewerken**) - en de Pointer is altijd de uitweg uit waar je ook in zit.

![De gereedschapsbalk van het vrije canvas: een sleepgreep, het Lolly-menu, dan Pointer, Vak toevoegen, Pen, Punten bewerken, Lijn, Tijdlijn, Tekenvlakken en Automatisch rangschikken](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Klik** om een punt te plaatsen. Bij het standaard curvetype trekt **klikken en slepen** de handvatten van dat punt naar buiten, en zo teken je een bocht in plaats van een hoek - houd **Alt** ingedrukt terwijl je klikt voor een harde hoek. (Bij de andere curvetypes is elk geplaatst punt een hoek en doet het slepen niets; zie **Splinetype** hieronder.)
- Punten klikken tijdens het plaatsen vast op het tekenvlak en op je andere vakken, en tekenen daarbij dezelfde hulplijnen als een gewone sleepbeweging. Alt onderdrukt het raster terwijl je tekent, en zowel het raster als de randen wanneer je daarna een punt versleept.
- **Klik op je eerste punt** om de lus te sluiten en in één beweging af te ronden. Druk anders op **Enter**, dubbelklik of wissel gewoon van gereedschap - de tekening blijft bewaard, hij wordt niet weggegooid.
- **Escape** werkt stap voor stap: de eerste druk laat de tekening varen en schrijft niets weg, een tweede verlaat de pen.
- **Delete** tijdens het tekenen verwijdert het laatste punt dat je plaatste.

Het resultaat is een gewoon vak op het canvas. Verplaats het, verander de grootte, roteer het, groepeer het, lijn het uit, herschik de stapelvolgorde, geef het een vulling, een verloop, een schaduw of een dekking - een pad gedraagt zich als elk ander vak, en geen van die bedieningselementen behandelt het anders.

Het komt ook gekleurd tevoorschijn. Het eerste pad dat je tekent, krijgt de vulling en de lijn die je merk aan een pad geeft, en daarna neemt elk nieuw pad over **wat je het laatst gebruikte** - stel de vulling één keer in en teken door, in plaats van elke vorm opnieuw te kleuren. (In een tool waarvan het merk niets over paden zegt, krijgt een getekend pad de lijnkleur waarin je het zag ontstaan, zodat het nooit onzichtbaar is.)

**De punten opnieuw bewerken.** Dubbelklik op de vorm (of gebruik **Punten bewerken** op de objectbalk) en de punten komen terug. Sleep een punt om het te verplaatsen, sleep een handvat om het opnieuw te richten, klik ergens op de curve om een punt in te voegen, trek een selectiekader om een groep punten en druk op Delete om de geselecteerde punten te verwijderen. Een pad houdt altijd minstens twee punten, dus je kunt het niet per ongeluk wegdelen.

**Splinetype** bepaalt wat voor curve er door je punten loopt, en dat is de keuze die het waard is om te begrijpen:

| Type | Wat het doet |
|---|---|
| **Vloeiend (auto)** | De standaard. Bepaalt zelf de lengte van de handvatten, zodat simpel klik-klik-klik een echt vloeiende curve oplevert zonder aan handvatten te sjorren. Stel je toch een handvat in, dan legt dat de *richting* vast en blijft de lengte eigendom van de curve. |
| **Bezier-handvatten** | De klassieke pen. De handvatten zijn de controlepunten, en een punt invoegen verplaatst de curve nooit. |
| **Door de punten** | Loopt precies door elk punt dat je plaatste, zonder handvatten. |
| **B-spline** | Stroomt langs de punten in plaats van erdoorheen, voor een zachtere vorm. |
| **Rechte lijnen** | Een polylijn. |

Een bestaand pad omzetten naar een type dat zijn eigen handvatten bepaalt, vraagt eerst om bevestiging, omdat de handvatlengtes die je instelde niet terug te halen zijn - omzetten naar **Bezier-handvatten** is altijd verliesvrij. Midden in het tekenen komt die vraag niet: de omzetting geldt meteen voor het concept, en alle handvatten die je al had uitgetrokken gaan mee. Bij de types die hun handvatten zelf bepalen, hervormt het invoegen van een punt de curve heel licht; bij **Bezier-handvatten** niet.

Elk punt draagt ook een continuïteitsregel, zichtbaar aan zijn vorm op het canvas - vierkant voor **Hoek** (handvatten bewegen onafhankelijk), rond voor **Vloeiend** (handvatten blijven in lijn), rond met een ring voor **Symmetrisch** (in lijn en van gelijke lengte). Stel hem in voor elk geselecteerd punt en de curve voldoet er meteen weer aan.

![Twee pentekeningen rechtstreeks vanuit een link gerenderd: een S-bocht met lijn en een gesloten gevulde vlek](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Een getekend pad reist net als al het andere mee in de link, dus een vorm die je tekent opent opnieuw vanuit een deel-link en rendert identiek vanaf de CLI. Niets eraan hangt af van de editor.

### Vormen combineren (padbewerkingen)

Selecteer twee of meer vormen, **rechtsklik** op het canvas (tweevingertik op touch) en het menu biedt de bewerkingen die je van een tekenprogramma verwacht:

- **Unie** voegt ze samen tot één vorm, met behoud van de verf van de bovenste.
- **Aftrekken** snijdt alles erboven weg uit de onderste vorm.
- **Doorsnijden** houdt alleen de overlap over.
- **Uitsluiten** houdt alles behalve de overlap.

Drie andere werken op één vorm: **Lijn omzetten in omtrek…** maakt van een lijn een gevulde vorm met dezelfde omtrek (handig als je een dikte precies wilt houden zoals hij getekend is), **Pad offsetten…** laat het silhouet naar buiten groeien of, met een negatief getal, naar binnen krimpen en **Vereenvoudigen** bouwt een pad opnieuw op met minder segmenten bij dezelfde vorm.

![Een halvemaan en een ring met een echt gat, beide gemaakt met Aftrekken](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Het resultaat is een nieuw pad dat je met de pen verder kunt bewerken. Gaten zijn echte gaten - een bedieningselement **Vulregel** op het lijnpaneel bepaalt of overlappende contouren vullen (*non-zero*) of erdoorheen ponsen (*even-odd*).

Twee dingen doen deze bewerkingen bewust niet. Ze **weigeren liever dan dat ze vernietigen**: vraag je om twee vormen te doorsnijden die elkaar niet overlappen, dan krijg je te horen dat er niets te behouden valt, en er verandert niets. En tekst- en afbeeldingsvakken hebben geen omtrek om mee te werken, dus die worden met rust gelaten in plaats van benaderd door hun kader. Een gecombineerd resultaat wordt bewaard als gewone bezierkrommen, precies zoals een tekenprogramma dat ook doet - het oorspronkelijke splinetype overleeft de bewerking niet.

## Tijdlijn (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** voegt *tijd* toe aan het vrije canvas. Elk vak kan op een moment beginnen, een tijd lang lopen en in- en uitanimeren, en een tijdlijn onder het tekenvlak is waar je ze ordent. Open hem en er speelt al een sequentie - een titelkaart, een clip, een eindkaart, een lower third en een muziekbed - zodat het model zichtbaar is voordat je iets verandert.

![De tijdlijn van Sequence Studio: het transport, de liniaal, een overlaylaan, de magnetische sequence-rij met zijn clips en naadchips en de Always on-strook](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Er zijn twee soorten rijen, en het verschil is het hele idee:

- De **sequentierij** is *magnetisch*. Clips liggen zonder gaten achter elkaar, en één verslepen herschikt de reeks in plaats van een gat achter te laten. Verwijder een clip en de rest sluit aan. Dit is je ruggengraat.
- **Overlaybanen** zijn vrij. Een lower third, een logo, een bijschrift - alles wat op zijn eigen moment boven de ruggengraat zweeft - krijgt een eigen baan en een eigen begin.
- Daaronder verzamelt **Altijd aan** de vakken zonder enige timing: decor dat er de hele tijd gewoon is. De `+` op een chip promoveert er een naar een baan; **Altijd aan maken** stuurt hem terug.

![Het bewerkingsstadium: het artboard voorop en centraal, de toolrail links en de zoom-HUD in de hoek](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Het openen van de tijdlijn geeft hem het toetsenbord, zodat Spatie en de pijltjestoetsen de afspeelkop besturen in plaats van de pagina - en omdat hij zichzelf opent bij een compositie die al timing heeft, geldt dat vanaf het moment dat Sequence Studio laadt.

> **[De sequentie-editor](/info/sequence-editor.html)** gaat dieper in op de vier dingen die bepalen of bewerken in de tijd voorspelbaar aanvoelt: welke clip een klik op het canvas bewerkt, uienschil-schaduwbeelden van de aangrenzende clips, het bereik van een splitsing en de Samenvoegen die een knip ongedaan maakt, en het trimmen (inclusief de toetsenbordset). Druk op `?` met de tijdlijn in focus voor het overzicht met sneltoetsen.

**Bewerken.** Sleep het midden van een clip om hem te verplaatsen of te herschikken, sleep binnen een paar pixels van een uiteinde om hem te trimmen en druk op **Splitsen bij playhead** (of `S`) om één clip in tweeën te knippen. Splitsen vraagt om een clip met een echte **Lengte** en een afspeelkop die er een stukje in staat, dus een open clip (het muziekbed bijvoorbeeld) kan niet gesplitst worden. **Uitlijnen op randen** staat standaard aan en klikt vast op clipranden, de afspeelkop en hele seconden, met Alt om dat te negeren. Elke sleepbeweging is één stap terug, en de sleepvoorvertoning rekent hetzelfde als de uiteindelijke bewerking, dus wat je tijdens het slepen ziet, is wat je krijgt.

Selecteer een clip en de inspector geeft je dezelfde bewerkingen als getallen: **Lengte**, **Intrimmen** (hoe ver in de bron hij begint), **Snelheid** als een reeks vaste vermenigvuldigers van ×0,25 tot ×4, **Animeer in** / **Animeer uit** met hun lengtes en **Clip dempen**. Een clip op de magnetische rij heeft bewust geen veld **Start** - de rij bezit de volgorde, dus je versleept hem om hem te verplaatsen.

**Overgangen** zijn presets, geen keyframes: Fade, Pop, Grow, Rise, Drop, de vier Slides, Zoom in en Zoom out, Tilt, Swoop, Spin, Drift of **Knip (geen animatie)**. Afstanden schalen mee met het object, zodat dezelfde preset klopt op een beeldvullende kaart en op een klein badge. Tussen twee aangrenzende clips op de sequentierij zit een **naadchip**: klik erop en kies **Knip** of **Crossfade**, wat meteen wordt toegepast waarna de chip sluit. Open dezelfde chip opnieuw om de **Lengte (ms)** te wijzigen en druk op **Klaar**. Een crossfade wordt bewaard als een uitfade van de ene en een infade in de volgende, en de export leidt de eigenlijke overvloeiing uit dat paar af - daarom ziet een crossfade er in de voorvertoning uit als twee fades en in het bestand als een echte overgave.

**Geluid.** Voeg een **Audio**-clip toe en die leeft op de tijdlijn als elke andere clip: golfvorm, trimmen, dempen. (Het gegenereerde bed waarmee de standaardsessie komt, is de enige uitzondering - het wordt bij het exporteren gesynthetiseerd, dus zijn balk blijft leeg en stil tot je rendert.) Druk op de microfoon om een **voice-over op te nemen** rechtstreeks op de tijdlijn, met aftellen en een niveaumeter, en de opname wordt bewaard als je eigen asset op het punt waar je begon. Druk op de camera ernaast om op dezelfde manier **een video op te nemen**: de opname wordt tijdens het opnemen bijgesneden tot de exportgrootte van het tekenvlak, zodat het kleine eigen beeld precies laat zien wat er bij de afspeelkop, beeldvullend, in de sequentie terechtkomt - de manier om de clip van een collega via een gedeelde link te verzamelen. Muziek, dialoog en het eigen geluid van een clip komen allemaal in de geëxporteerde mix. (Het **audiospoor** van het exportpaneel is iets anders: één bed onder de hele clip, met fade en ducking. Ze bestaan naast elkaar.)

**Renderen.** Een bewegingsexport is een **deterministische compositie**, geen schermopname - elk frame wordt op een exact tijdstip gedecodeerd, getekend en gecodeerd, dus het bestand hangt er niet van af of je machine het bijhoudt, en er is geen praktisch framemaximum voor MP4 of WebM. De lengte van de tijdlijn zelf bepaalt de duur, tenzij je er een intypt. Content Credentials worden gestempeld zoals bij elke andere export. Een stilstaande export geeft je het frame bij de afspeelkop, of een heel contactblad via het veld **Frames** naast de uitvoergrootte - zie [Exporteren](/info/exporting.html#stills-from-a-timed-composition).

Een paar grenzen om in gedachten te houden: een sequentie is gemaximeerd op één uur, GIF en geanimeerde PNG bufferen hun frames en blijven daarom kort, audio is stil op een clip waarvan de snelheid niet ×1 is (time-stretching bestaat nog niet) en **Live opnemen** is hier verborgen omdat de compositor de betere weg is.

**Meer dan presets: keyframes, diepte en een camera.** Een overgang animeert een clip terwijl die aankomt en vertrekt. Om een box *binnen* een clip te poseren - laten driften, laten faden, vervagen, van de pagina tillen en weer laten landen - voeg je keyframes toe: selecteer de clip, druk op **+Keyframe** (het ruitje in de toolcluster van de tijdlijn, het ruitje op de canvas-objectbalk of `K`) en de positie van de afspeelkop bepaalt welke pose je volgende bewerking vastlegt. Hetzelfde keyframe-systeem geeft elke getimede compositie een **camera** die inzoomt, meepant en scherpstelt, en die één platte SVG omzet in een stapel lagen waartussen je kunt vliegen. **[Animeren](/info/animating.html)** is de volledige handleiding.

De Design-tool heeft dezelfde tijdlijn, dus je kunt een layout van timing voorzien zonder naar een andere tool te gaan, en hij exporteert ook beweging.

## Presenteren

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Een Design-document dat uit **tekenvlakken** bestaat, is al een presentatie. Open het **Lolly-menu** op de gereedschapsbalk en kies **Presenteren** - de onderste rij - en elk tekenvlak wordt een schermvullende dia, in de volgorde waarin de tekenvlakken op het canvas staan. De presentatie draait op een kopie van de gerenderde tekenvlakken, dus de editor eronder wordt nooit aangeraakt en bij het verlaten sta je precies waar je was.

- **Verder** met **Space**, `→`, **Page Down** of een klik op de strook aan de rechterrand van het scherm; ga terug met `←`, **Page Up** of de strook aan de linkerrand. **Home** en **End** springen naar de eerste en de laatste slide. Een kleine balk met bedieningselementen vervaagt in beeld zodra je de muis beweegt en verdwijnt weer zodra je stopt.
- **Overview** (`O` of de rasterknop) legt alle artboards in één keer neer, in de volgorde die je ze op het canvas hebt gegeven; klik op één om hem te openen.
- **Stappen onthullen.** Klik met de rechtermuisknop op een box en kies **Reveal at step 1**, **2** of **3** in plaats van de standaard **Always visible**. Die box wacht dan tot je naar zijn stap doorgaat, zodat een slide in stukken kan verschijnen; boxes met hetzelfde nummer verschijnen samen.
- **Speaker view** (`S`) opent een tweede venster met de huidige slide, de eerstvolgende, je notities bij die slide en een lopende klok. Als de browser de pop-up blokkeert, valt het terug op een paneel over het deck. Notities worden per artboard ingesteld en verschijnen nooit op de slide zelf.
- `B` houdt een zwart scherm vast (elke toets brengt de slide terug), `F` keert terug naar volledig scherm en **Escape** pelt telkens één laag af: overzicht terug naar het deck, deck terug naar de editor.
- **Kiosk.** Geef een artboard een **Length** en het deck blijft daar zo lang staan, om daarna vanzelf verder te gaan achter een dunne voortgangsbalk; `K` (of de pauzeknop, die pas verschijnt zodra iets een lengte heeft) stopt en herstart dat. Voeg `kiosk` toe aan de link en het deck loopt aan het einde door naar het begin, wat er signage van maakt.

De presentatie is ook een link. `?present` opent er meteen in, `s=` benoemt de dia - een positie, een tekenvlak-id of `id.step` voor een opbouwstap - en het adres wordt bijgewerkt terwijl je verder gaat, dus wat je verstuurt is de dia waar je staat. Toolauteurs: die parameters zijn gedocumenteerd op de pagina [URL-modus](/info/url-mode.html#reserved-parameters).

## Op een telefoon

Op smalle schermen vloeit de layout om naar één kolom:

- De **bedieningselementen worden een sheet** bovenaan met een **sleepgreep** aan de onderrand. Sleep de greep om de grootte aan te passen - hij klikt vast op **kijkje / half / volledig** - of **tik** op de greep om te wisselen tussen ingeklapt ↔ uitgeklapt. De voorvertoning vult de ruimte eronder en blijft zichtbaar terwijl je bewerkt.
- Een zwevende knop **Exporteren** opent de exportsheet - alle bedieningselementen voor formaat, grootte, kopiëren, opslaan en downloaden op één plek. Sluit hem door op de achtergrond te tikken.

![Een tool op een schermbreedte van een telefoon - bedieningselementen als sheet bovenin, het gegenereerde palet dat de voorvertoning eronder vult en de renderpil die onderaan het midden zweeft](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Bedieningselementen (invoervelden)

Tools tonen alleen de invoervelden die bedoeld zijn om te variëren - al het andere (kleuren, layout, typografie, logica) ligt vast door de maker van de tool, zodat alles wat je maakt voldoet aan de regels die de maker heeft gesteld. Invoervelden zijn onder meer tekst, schuifregelaars, kleurkiezers, dropdowns, datums, afbeeldingkiezers en herhalende rijgroepen. Sommige zijn gegroepeerd onder inklapbare secties.

![De stapel bedieningselementen van een tool - een tekstveld, kleurknoppen en een schuifregelaar, en verder niets: de rest heeft de maker vastgezet](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Reset:** *Wijzigingen wissen* zet elk invoerveld terug naar de standaardwaarde.

### Ongedaan maken en opnieuw

**Cmd/Ctrl-Z** zet een stap terug en **Cmd/Ctrl-Shift-Z** (of **Cmd/Ctrl-Y**) zet weer een stap vooruit. Datzelfde paar staat als knoppen **Ongedaan maken** en **Opnieuw** in de rij boven de bedieningselementen - op het vrije canvas staan ze in plaats daarvan op de gereedschapsbalk - en elk wordt grijs zodra er niets meer terug te nemen valt. Elke stap zegt wat hij was: maak een kleur ongedaan en een klein bericht noemt het invoerveld dat het net herstelde, met een knop **Opnieuw** erin voor de weg terug.

- **Een sleepbeweging is één stap.** Herhaalde wijzigingen aan hetzelfde bedieningselement binnen een halve seconde smelten samen, dus een schuifregelaar over zijn hele bereik trekken is één stap terug in plaats van tweehonderd.
- **De laatste 100 stappen worden bewaard** - oudere vallen aan het eind af. Een nieuwe bewerking na het ongedaan maken wist de stapel vooruit, zoals overal elders.
- **Zolang je cursor in een tekstveld staat**, is Cmd/Ctrl-Z van dat veld zelf, teken voor teken. Lolly neemt het over voor de bedieningselementen die geen bruikbare eigen ongedaanmaakfunctie hebben: schuifregelaars, dropdowns, kleuren en schakelaars.
- **Een bestand kiezen** in een **bestand**-invoerveld is geen stap - die bytes worden alleen voor de sessie bewaard, dus er zou niets terug te zetten zijn.

In een live-[samenwerking](/info/collaborate.html) blijft de geschiedenis alleen van jou. Een wijziging die van het andere apparaat binnenkomt, komt nooit op jouw stack terecht, dus ongedaan maken kan alleen ooit iets terugdraaien dat jij hebt gedaan.

## Jouw gegevens & pasfoto

**Profiel** (rechtsboven in de galerij) bevat je naam, contactgegevens en een optionele **pasfoto**. Tools die om die velden vragen, vullen ze automatisch vooraf in - stel ze eenmalig in en je e-mailhandtekening, lockups en badges vullen zichzelf in. Je kunt elk veld per sessie nog altijd overschrijven. Zet **Gebruik mijn gegevens om te maken** aan zodat je gegevens als auteur meereizen met wat je exporteert.

Je pasfoto en gegevens staan **alleen op dit apparaat**. Een profiel kan meer zijn dan alleen jij - een team of een rol die je af en toe op je neemt. Zie **[Profielen](/info/profile.html)** voor het volledige verhaal, inclusief het bijhouden van meer dan één.

## Opslaan & doorgaan

Klik op **Opslaan** om de huidige invoer op te slaan als sessie voor die tool. Je kunt meerdere benoemde sessies per tool bewaren; de **Doorgaan**-knop van elke tool heropent je meest recente, en de **geschiedenisknop** (rechtsboven, naast je profiel) toont elke opgeslagen sessie van alle tools. Sessies zijn apparaatgebonden. Om ze te organiseren open je **Projecten** (hieronder).

![De renderpil in twee helften - een pijl omhoog die het exportpaneel opent, en een vinkje dat de sessie ter plekke opslaat](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projecten

**Projecten** - open het via het tabblad **Projecten** naast **Tools**, of via **Profiel → Opslag → Organiseren in Projecten** - is een thuisbasis voor alles wat je hebt opgeslagen, en het werkt als een bestandsbeheerder:

![Projecten - opgeslagen sessies geordend in nestbare mappen](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Geneste mappen.** Groepeer opgeslagen sessies in mappen, en mappen in mappen, zo diep als je wilt. Maak een map aan, hernoem hem of sleep een tegel op een andere map om die te verplaatsen; een broodkruimelpad brengt je weer omhoog. Een altijd aanwezige map **Zonder categorie** bevat alles wat nog niet is opgeborgen.
- <!--i:clock--> **Sorteer op je eigen manier.** **Weergeven & sorteren** biedt **Naam**, **Toegevoegd op**, **Laatst gewijzigd** (de standaard) en, binnen een map, **Op tool**. Mappen komen altijd eerst, welke sortering ook actief is - de sortering ordent alleen de sessies en mappen binnen hun eigen groep.
- <!--i:document--> **Berg nieuw werk direct op.** **Nieuw asset** ("Begin een nieuwe creatie" in de hoofdmap, "Toevoegen aan *map*" binnen een map) opent een tool en bergt de eerste opslag automatisch in die map op.
- <!--i:checklist--> **Meervoudige selectie (desktop).** Vink het selectievakje van een tegel aan, sleep een selectiekader over lege ruimte of gebruik **Shift/Cmd-klik**; **rechtsklik** op een tegel voor het contextmenu. Voer daarna een actie uit op de hele selectie tegelijk - hetzelfde gebaar en dezelfde zwevende actiebalk werken op de galerij Tools, Hulpprogramma's, de Catalogus en Projecten, niet alleen hier.
- <!--i:download--> **Render een hele map of selectie.** **Map renderen** exporteert elke opgeslagen sessie in een map - inclusief submappen - als één geneste `.zip`. **Selectie renderen** doet hetzelfde voor elke meervoudige selectie, en een enkele sessie rendert rechtstreeks naar zijn eigen bestand. Geen Batch/Pro nodig.
- <!--i:link--> **Spring direct naar het opgeslagen werk van een tool.** Vink een of meer tools aan in de galerij Tools en kies **Sessies bekijken** in de selectiebalk - Projecten opent met alleen de sessies die met die tools zijn gemaakt, met een **Wissen** om terug te gaan naar het volledige overzicht.
- <!--i:link--> **Deel een opgeslagen sessie.** Rechtsklik op een sessie → **Link delen** om een link te kopiëren die deze heropent met exact dezelfde invoer (de volledige Deel-dialoog - zie hieronder).

![De geopende popover Weergeven en sorteren in Projecten, met een themarij, een keuze bij Weergeven tussen Voorvertoning of Lijst en Naam, Toegevoegd op en Laatst gewijzigd onder Sorteren](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

**Wat de selectiebalk biedt** verschilt iets per weergave, want niet elke actie is overal zinvol:

- **Tools / Hulpprogramma's:** Favoriet (of Favoriet verwijderen), Verbergen (of Zichtbaar maken), Offline beschikbaar (of Uit offline verwijderen), **Sessies bekijken** (de sprong die hierboven staat beschreven) en Link kopiëren wanneer er precies één kaart geselecteerd is.
- **Catalogus:** Favoriet en Verbergen gelden voor elke selectie; Dupliceren, Downloaden en Verwijderen verschijnen pas wanneer elk geselecteerd item een van je eigen uploads is - een gedeeld design-systeemasset is een blijvend contract, dus die drie blijven er ook in bulk van af.
- **Projecten:** **Selectie renderen**, **Verplaatsen naar…**, **Nieuwe map**, **Verwijderen**, **Samen bewerken** wanneer de selectie tussen twee en acht sessies van één tool telt (die openen naast elkaar onder één gecombineerde zijbalk) en **Bewerken als sheet**, dat de hele selectie in plaats daarvan opent als rijen in het batchraster. Dat laatste kent **geen limiet** en trekt zich er niets van aan of de sessies van dezelfde tool komen, dus het is de uitweg wanneer een selectie groter of gemengder is dan de twee tot acht van Samen bewerken.

> Één labelvalkuil: **Sessies bekijken** bestaat alleen zodra er iets *geselecteerd* is. Rechtsklikken op een enkele niet-geselecteerde kaart biedt in plaats daarvan **N opgeslagen sessies**, wat het eigen geschiedenisvenster van die tool opent in plaats van naar Projecten te navigeren.

![Twee toolkaarten aangevinkt in de Tools-galerij, met de zwevende selectiebalk die '2 selected' toont en Available offline, View sessions, Favourite en Hide aanbiedt](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive-doelen `[data-select="qr-code"]` /
`[data-select="gradient"]` - de checkboxknop `.tile-check[data-select="<ref>"]`
rechtstreeks bevestigd in de kaartmarkup van views/gallery.ts (hetzelfde attribuut
dat cardMarkup elke tile geeft), dus deze twee klikken vinken beide kaarten aan
zonder een van beide tools te openen.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Je werk delen

Een ontwerp gaat op één van twee manieren de deur uit: als link of als bestand. De Deel-dialoog biedt allebei. Open hem met **Delen** in de exportbediening; **Link delen** bij een opgeslagen sessie in Projecten opent dezelfde dialoog voor die sessie.

### De link

Elke invoer wordt vastgelegd in de pagina-URL, dus een link *is* het ontwerp. Bovenaan de dialoog staat de direct te kopiëren link, met twee ingeklapte secties eronder.

- **Linkopties** bevat **Kortste link** (een groot ontwerp levert een lange URL op, dus dit pakt de volledige status in een compact token en laat je de besparing in tekens zien; de leesbare vorm is er altijd ook), **Deze link met een wachtwoord beveiligen** (AES-256 over de hele link, het wachtwoord staat er nooit in) en **Deze toolversie vastzetten** - de vlag `_v`, die de link vastpint op de toolversie die je voor je hebt, zodat een latere update niet kan veranderen wat hij rendert.
- **Linkgedrag** is wat er gebeurt wanneer de ontvanger hem opent: volledig scherm, het exportpaneel al uitgeklapt, downloaden-bij-openen met `&export` of kopiëren-naar-klembord met `&copy`.

Plak de link naar een collega, bookmark hem of commit hem. (Volledige details: [URL-modus](/info/url-mode.html).)

**Bij sommige tools is de link het hele product.** Jump Page verzamelt je links op één pagina om uit te delen - een bio-link, een conferentiepraatje, een winkelpui. Er is niets te hosten en geen account nodig: de pagina is de link, dus die opent zo snel als de URL reist. In de editor zie je de afgewerkte pagina naast de velden; een bezoeker die de link opent, krijgt hem op volle breedte, één link per scène terwijl hij scrollt.

![Jump Page in de editor - de kop, drie linkscènes elk met een eigen kleurwas en een 'Made with Lolly'-voettekst, uitgelijnd als één pagina op het canvas](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**De dialoog zegt wat een link niet kan meenemen.** Drie dingen passen niet in een URL: een afbeelding of bestand dat je vanaf dit apparaat hebt toegevoegd, een heel lange tekstwaarde of een heel grote lijst. Elk daarvan wordt geteld terwijl de link wordt opgebouwd. Als er iets weg moest, noemt de dialoog het en wijst hij je naar het bestand hieronder, in plaats van je een link te geven die opent met de afbeelding weg. Een link die alleen maar *lang* is, krijgt een mildere melding met zijn aantal tekens, want inpakken kan lengte nog redden.

### Het .lolly-bestand

**Download .lolly**, in de Deel-dialoog van de tool waarin je werkt, schrijft hetzelfde ontwerp weg als bestand. Het draagt de opgeslagen sessie samen met de afbeeldingen en bestanden die je vanaf je apparaat hebt toegevoegd. De catalogusbeelden waar het ontwerp uit put, reizen er ook in mee, zodat het bestand compleet opent op een machine die je merk nooit heeft gezien. Waar je apparaat een deelmenu heeft, geeft **Versturen naar…** dat bestand er rechtstreeks aan door (AirDrop, een Android-deelactie) in plaats van het naar schijf op te slaan.

Een `.lolly` is een gewone zip. Hernoem hem naar `.zip` en open hem: je eigen afbeeldingen staan onder `assets/uploads/` en catalogusbeelden onder `assets/catalog/`, elk met hun echte naam en extensie, `manifest.json` somt ze allemaal op en een README bovenin zegt wat het bestand is.

Drie dingen bepaal jij voordat het weggaat:

- **Of je naam erin komt.** Je naam, e-mailadres en organisatie worden alleen in het bestand geschreven als **Use my details to create** aanstaat in je profiel. Als dat uitstaat, registreert het bestand dat het met Lolly is gemaakt en wanneer - niets over jou.
- **Of gelicentieerde afbeeldingen erin komen.** Gelicentieerde en merk-vergrendelde assets worden standaard achtergehouden. Als het ontwerp die gebruikt, meldt de dialoog hoeveel er zijn en biedt twee knoppen - *Download without them* of *Include and download* - want ze meenemen geeft de daadwerkelijke bestanden aan wie het `.lolly`-bestand opent.
- **Of de tool erin komt.** **Include the tool** pakt de eigen bestanden van de tool bij het ontwerp in, zodat het opent op een apparaat dat die tool niet heeft. Het staat aangevinkt voor een custom tool - een fork of een private brandtool die je ontvanger waarschijnlijk niet heeft - en uitgevinkt voor een tool die de ondertekende catalogus vermeldt, omdat hun exemplaar uit dezelfde bron komt. (Op een build zonder ondertekende catalogus telt elke tool als custom en begint het vinkje aangevinkt.)

**Een bestand openen.** Zet een `.lolly` op de app: de assets gaan naar je bibliotheek, de sessie gaat naar Projects en de tool opent erop. Niets van jou wordt overschreven: de sessie komt binnen als een nieuw opgeslagen item, terwijl een asset die al op dit apparaat staat, via checksum wordt herkend en hergebruikt in plaats van gedupliceerd. Elk onderdeel wordt bij binnenkomst gecontroleerd aan de hand van de eigen checksums van het bestand, zodat een kopie die onderweg beschadigd is, wordt geweigerd in plaats van half geïmporteerd.

Draagt het bestand een tool die je niet hebt, dan vraagt Lolly het eerst voordat die tool mag draaien: **Deze tool vertrouwen?** noemt de tool en zijn auteur en zegt onomwonden dat openen de eigen code van de tool op je apparaat uitvoert, met **Vertrouwen & installeren** als de weg erdoorheen. Weiger je, dan wordt het gedeelde werk toch in je projecten opgeslagen en wacht het daar op de dag dat je de tool toevoegt. (Één soort tool kan nog niet zo geladen worden - een tool waarvan de code als module wordt geleverd - en die wordt op dezelfde manier geweigerd.)

Een link en een bestand geven allebei een momentopname door. Om *tegelijkertijd* met iemand anders aan dezelfde sessie te werken - twee apparaten, geen server, geen internet nodig als je op één netwerk zit - zie [Samenwerken](/info/collaborate.html).

## Live camera (bewegingsgevoelige tools)

Elk foto-**filter** - Halftone, Scanline, Posterize, Voronoi-cellen, Kleurbewerking, Pixel stretch en Imperfecties - toont een knop **Live gaan** waar een camera beschikbaar is. Zet hem aan en het effect volgt je webcam beeld voor beeld, zodat het op beweging reageert; je kunt het resultaat opnemen naar GIF, WebM of MP4. Beelden worden **op je apparaat** gelezen en verwerkt en verlaten het nooit, en de camera wordt losgelaten zodra je stopt of de tool verlaat. (Elke afbeeldingkiezer heeft ook **Maak een foto** om één beeld vast te leggen als afbeelding op het apparaat.)

## Mijn afbeeldingen

Wanneer een tool je een afbeelding vanaf je apparaat laat toevoegen, wordt die bewaard precies zoals hij binnenkwam - zodat een Content Credential erop nog steeds verifieert - en opgeslagen in je persoonlijke bibliotheek **Mijn afbeeldingen** (onder **Profiel → Opslag**). Alleen bij een werkelijk enorm bestand wordt gevraagd of je het wilt houden of verkleinen. Hergebruik het in elke tool. Om EXIF/GPS te wissen zodra afbeeldingen binnenkomen, zet je **Metadata uit uploads verwijderen** aan in je profiel. Er is geen limiet: de bibliotheek is volledig lokaal en wordt alleen begrensd door de opslag van je apparaat - beheer of verwijder afbeeldingen daar.

## De Catalogus - je assetbibliotheek

De **Catalogus** (`#/c`, of het segment **Catalogus** van de schakelaar Projecten · Tools · Hulpprogramma's · Catalogus bovenaan elke overzichtsweergave) verzamelt alles waar je tools uit kunnen putten - merklogo's, afbeeldingen, audio en beweging, gegroepeerd per soort - en het is ook waar je **eigen creatieve bestanden** leven. Geen server, geen adminconsole, geen pull request: alles staat op je apparaat.

![De Catalogus - merkassets, stalen en lettertypen, plus je eigen uploads](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Breng je bestanden binnen.** Sleep een afbeelding, SVG, audioclip, video, Lottie, PDF of PowerPoint-deck naar het uploadgebied - of klik om te kiezen - en het komt direct in je catalogus terecht, klaar in de asset-kiezer van elke tool. Een meerpagina-PDF of een `.pptx` vraagt welke pagina's of slides je wilt behouden - elke wordt een SVG-asset. Importeer zoveel je wilt; het verlaat je apparaat nooit.
- <!--i:star--> **Markeer als favoriet wat je vaak gebruikt.** Geef een asset (of een merkstaal) een ★ en die wordt vastgepind bovenaan elke kiezer, zodat je vaste logo of kleur één klik verwijderd is.
- <!--i:folder--> **Ruim op.** Herindeel een asset naar een andere groep, verberg een gedeelde merkasset die je niet gebruikt (met **Show hidden** om hem terug te halen) of verwijder je eigen uploads volledig. Hetzelfde multiselectgebaar en dezelfde zwevende actiebalk als bij Projects werken hier ook, zodat dit allemaal op een hele selectie tegelijk kan.
- <!--i:layers--> **Til een video van zijn achtergrond.** Open het detail van een video of klik met de rechtermuisknop op de kaart in een willekeurige asset-kiezer en kies **Remove background…** om een transparant alternatief op te slaan - een geanimeerde WebP of PNG met echte alpha. Kies een **Method**: een **On-device model** snijdt een onderwerp uit een drukke scène, of een **Colour key** trekt een egaal verlichte, vlakke achtergrond eruit zoals een greenscreen of een effen muur, met **Tolerance**, **Softness** en **Spill removal** om de rand bij te stellen. De colour key heeft geen modeldownload en geen netwerk nodig, dus **Remove background** wordt bij elke video aangeboden en geeft vaak een schoner resultaat bij nette beelden. Een **Resolution**-instelling (360, 480, 720 of 1080p, nooit verder dan de bron) ruilt detail in voor een kleiner, sneller bestand. Het draait als achtergrondtaak op je apparaat. De afgewerkte uitsnede wordt naast het origineel opgeslagen als eigen asset en de Content Credential van de bronvideo reist mee als ingrediënt. (Zie [Eenmaal gegenereerd, hetzelfde gerenderd](/info/ai-features.html) voor waarom het verwijderen van een achtergrond een gewone bewerking blijft.)

### Neem je palet en lettertypen overal mee naartoe

Het paneel **Stalen** van de Catalogus doet meer dan tonen - klik op een kleur om hem te kopiëren, of **download het volledige merkpalet** in het formaat dat je andere tool spreekt:

- <!--i:code--> **Design tokens (JSON)**, **CSS-variabelen** of **CSS-classes** - zet het merk rechtstreeks in een stylesheet of een build;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - laad het in Illustrator of Photoshop;
- <!--i:pentool--> **GIMP-palet (.gpl)** - voor GIMP of Inkscape.

![Het paneel Stalen - de vijf paletdownloadknoppen bovenaan, en daaronder elke merkkleur als kopieerbare chip](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Het paneel **Lettertypen** toont je merklettertypen met een **download** naast elk, om lokaal te installeren of aan een drukkerij te geven. (De kamer Kleuren van de [Brand Studio](/info/brand-studio.html) biedt dezelfde paletdownload.)

Assets zijn de ene helft van het open, doe-het-zelf-pad; de andere is **je eigen tools maken** - het vrije canvas (Design, hierboven beschreven) laat je er visueel een bouwen, zonder code.

## Geluid & toegankelijkheid

Lolly streeft ernaar voor iedereen prettig te gebruiken te zijn. De interface is met het toetsenbord te navigeren, aangepaste bedieningselementen hebben correcte labels voor schermlezers en de live voorvertoning van elke tool wordt weergegeven als één gelabelde afbeelding die beschrijft wat er wordt gemaakt.

Een subtiele laag **ondersteunende geluiden** bevestigt wat je doet - aankomen in de galerij, een geldige versus ongeldige Content Credentials-controle, een paneel sluiten, een filter wisselen. Het staat **standaard uit**: zet **Geluid** aan waar de schakelaar ook verschijnt (het optiepaneel van elke weergave, of **Profiel**), en de keuze wordt onthouden.

Vier optionele comfortinstellingen staan onder **Profiel → Toegankelijkheid**: **Beweging beperken** (laat de overgangen en franje van de app vallen), **Kleurrijke voorvertoningen verbergen** (rustige galerijkaarten met alleen pictogram en tekst, en kalmere projectminiaturen), **Hoog contrast** (sterkere randen, tekst en focusringen) en **Grote tekst** (grotere app-typografie - labels, menu's, knoptekst). Alle vier brengen rust *rondom* je werk: ze komen nooit binnen een toolcanvas en veranderen geen pixel van wat je exporteert, en elk staat uit tot je het aanzet. Volledige details in [Je profiel → Toegankelijkheid](/info/profile.html#accessibility).

Naast de schakelaar Geluid staat **Neurospicy-modus** - een optionele, rustgevende achtergrond-focustrack die zachtjes speelt terwijl je werkt. Als je hem aanzet, opent er een klein **spelerdock** in de onderhoek dat je door de hele app volgt; van daaruit kun je een track zoeken en kiezen, vooruit- en terugspringen, het volume instellen en hem minimaliseren of sluiten. De tracklijst omvat een paar categorieën - procedurele *Lolly Sings*-deuntjes, ambient loops en beats, je eigen geüploade audio en een handjevol live internet-**radio**stations (deze hebben een verbinding nodig; al het andere speelt offline). Hij staat **standaard uit** en wordt, net als Geluid, onthouden tussen sessies en apparaten. Geluid uitzetten dempt ook de focustrack.

## Opslag & privacy

Alles wordt opgeslagen in de lokale database van je browser (IndexedDB): je profiel, opgeslagen sessies, geüploade afbeeldingen en een cache van gedownloade catalogusinhoud. **Profiel → Opslag** toont het gebruik en biedt je de mogelijkheid om:

- <!--i:box--> **Cache wissen** - verwijder gedownloade catalogusinhoud (wordt bij de volgende keer laden opnieuw gesynchroniseerd).
- <!--i:trash--> **Al mijn gegevens wissen** - verwijder profiel, sessies en afbeeldingen volledig. *Kan niet ongedaan worden gemaakt.*

![De opslagkaart op een schermbreedte van een telefoon: elke categorie gegevens op het apparaat met naam genoemd, met onderaan de knop Al mijn gegevens wissen](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Niets van deze lokale gegevens wordt ergens naartoe verzonden - geen telemetrie, geen cloud-rendering. De volledige lijst van wat de app ooit ophaalt of verstuurt staat in het [Privacybeleid](/info/privacy.html), en [Serveroppervlak](/info/server-surface.html) inventariseert de optionele servercomponenten.

## Overstappen naar een ander apparaat

Omdat alles op je apparaat leeft, kun je via **Profiel → Opslag → Overstappen naar een ander apparaat** alles meenemen naar een tweede installatie - geen account, geen cloud:

- <!--i:download--> **Exporteer mijn gegevens** downloadt één `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (de naamdelen komen uit je profiel en worden weggelaten als ze niet zijn ingesteld; `<n>` is een teller per dag zodat exports op dezelfde dag niet botsen) met daarin je profiel, elke opgeslagen sessie (met bijbehorende miniatuur), je geüploade afbeeldingen en je voorkeuren (thema, breedte van de zijbalk, lokale activiteitsstatistieken).
- <!--i:upload--> **Gegevens importeren…** op de andere installatie leest dat bestand weer in. Dit **voegt samen**: alles met dezelfde naam (je profiel, een sessieslot, een afbeelding) wordt vervangen door de geïmporteerde versie; al het andere op dat apparaat blijft behouden. Opgeslagen sessies worden automatisch opnieuw gekoppeld aan je geïmporteerde afbeeldingen.

De catalogus-cache is niet inbegrepen - die wordt op het nieuwe apparaat opnieuw gedownload. Het pakket is een gewone zip (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, format-id `lolly-backup`), zodat het intact blijft na e-mail, USB of AirDrop en overal hetzelfde formaat is dat elke shell inleest. Elk onderdeel heeft een checksum, zodat een bestand dat onderweg beschadigd raakt bij het importeren wordt opgemerkt in plaats van halfstuk te worden hersteld. (Volledige formaatspecificatie: [Gegevensoverdracht](/info/data-transfer.html).)

## Een ontwerp importeren (Figma, Penpot, Illustrator, InDesign)

Je kunt een bestaand ontwerp in Lolly binnenhalen en ermee verder werken: open **Design**, klik op **Ontwerp importeren** in de werkbalk van het canvas en kies een Figma **.fig** of SVG, een Penpot **.penpot**, een Illustrator **.ai** / **.pdf** of een InDesign **.idml**. Lagen worden bewerkbare vakken op het vrije canvas - tekst blijft herschrijfbaar, afbeeldingen komen terecht in **Mijn afbeeldingen** en typografie en kleuren voegen zich naar de merkglobals - waarna het resultaat wordt opgeslagen, gedeeld en gerenderd als elke andere sessie. Het parsen gebeurt volledig op je apparaat. Volledige details: **[Een ontwerp importeren](/info/design-import.html)**.

## Exporteren

Zie **[Exporteren & formaten](/info/exporting.html)** voor het volledige verhaal - een formaat kiezen, uitvoergrootte en printeenheden, transparantie, video en kopiëren/delen. Kort samengevat: kies een formaat, stel indien nodig de grootte in en klik op **Downloaden** (of **Kopiëren** naar het klembord).

## Batch-modus (Pro)

Voor gevorderde gebruikers rendert **Batch** (gelinkt vanuit de galerij, afgeschermd achter de Pro-functievlag, die standaard aan staat) veel varianten tegelijk - een raster waarin elke rij een set invoer is, samen geëxporteerd. Ideaal om een kaart in een tiental talen te lokaliseren of om elke formaatvariant in één keer te genereren. Vul rijen door te typen, rechtstreeks vanuit een spreadsheet te plakken of een CSV te importeren (je kunt er ook weer een exporteren), en stel per rij het formaat, de grootte en de uitvoerbestandsnaam in. Sla een heel raster op als een benoemde **batch-sessie** die vanuit de galerij weer opent, en download elke rij als één `.zip`.

![De batch-werkbalk - zipnaam, eenheden, DPI en het formaat dat elke rij erft, met Sessions en Render rechts](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch is bedoeld om **veel varianten van één template** tegelijk te genereren. Om sessies die je **al hebt opgeslagen** opnieuw te renderen, gebruik je **Projecten → Map renderen / Selectie renderen** (hierboven) - geen Pro nodig.

## Naast elkaar bewerken (Multi-edit)

Batch is vele varianten van *één* ontwerp. **Multi-edit** is de andere helft van de klus: meerdere **verschillende** opgeslagen ontwerpen tegelijk geopend, zodat één wijziging op ze allemaal wordt toegepast. Vink **twee tot acht** opgeslagen sessies aan in **Projects** en kies **Edit together** uit de selectiebalk; ze openen als live kaarten naast elkaar op `#/multi?s=<slot>,<slot>…`. Elke kaart is een echte render van die sessie, geen opgeslagen thumbnail, dus wat je ziet is wat er geëxporteerd wordt.

Eén zijbalk bestuurt het geheel:

- <!--i:sliders--> **Gedeeld** staat voorop - elk invoerveld dat twee of meer van de geselecteerde sessies op *dezelfde manier* declareren (dezelfde id, hetzelfde type, dezelfde beperkingen - dezelfde samenvoegregel die het batchraster op zijn kolommen toepast). Bewerk een gedeeld bedieningselement één keer en de waarde waaiert uit naar elke sessie die het declareert, live op elke kaart. Twee sessies van dezelfde tool delen alles; twee verschillende tools delen wat ze toevallig gemeen hebben, en verder niets.
- <!--i:document--> Daaronder **één ingeklapte kaart per sessie** met alle eigen invoervelden van die sessie, in dezelfde kwaliteit als de zijbalk van de tool zelf - assetkiezers, herhalende rijgroepen, kleurvelden - plus een compact exportblok: **Formaat**, **B** / **H**, **Eenheid**, **DPI** en een eigen **Downloaden**. Dat Downloaden slaat de sessie eerst op en rendert hem daarna via het gewone sessie-exportpad, zodat het bestand dezelfde bestandsnaam, hetzelfde formaat en dezelfde Content Credentials draagt als rechtstreeks uit de tool.
- <!--i:search--> **Invoervelden filteren…** bovenaan versmalt de bedieningselementen over *alle* kaarten tegelijk - en zo kom je in acht sessies bij "de kop" zonder ernaar te scrollen.

Klik op een willekeurig canvas (of druk er Enter op) en de zijbalkkaart van die sessie klapt open en scrolt in beeld. **Alles opslaan** schrijft elke sessie terug naar zijn eigen slot. **Alles downloaden** slaat eerst op en rendert daarna de hele set door dezelfde pijplijn als **Selectie renderen** in Projecten - één zip, met onderweg het optionele wachtwoordslot als aanbod.

Twee eerlijke grenzen. De limiet van twee tot acht is echt: elke kaart start zijn eigen live runtime, en dat is het aantal dat responsief blijft - een link die om meer vraagt (of om een sessie die niet meer bestaat) zegt dat, in plaats van half te laden. En de link noemt *jouw* opgeslagen slots, dus hij heropent die set op dit apparaat; het is geen deel-link.

Is de selectie groter dan acht, mengt hij tools of bevat hij naast sessies ook afbeeldingen, dan is de uitweg **Bewerken als sheet** in dezelfde selectiebalk: die opent de hele selectie als **rijen in het batchraster** (`#/pro?s=…`), zonder limiet en zonder regel over dezelfde tool. Mappen blijven buiten allebei - die hebben hun eigen pad om in het raster te openen. ([Zoeken](/info/search.html) is het enige dat hier nog niet bij kan: Multi-edit is de enige weergave die de zoekbalk niet kent.)

## Offline & installeren

Lolly is een PWA. Na de eerste keer laden werkt hij **offline** - installeer hem vanuit de adresbalk van je browser (of *Toevoegen aan beginscherm* op mobiel) voor een app-achtige, volledig schermvullende ervaring. Hij werkt zichzelf bij zodra je weer online bent.

Over updates: als een weergave direct na een update ooit niet laadt (een leeg paneel, een "failed to fetch" in de hoek), laad de pagina dan één keer opnieuw - de app pakt de nieuwe versie netjes op en je werk, sessies en merk blijven onaangetast. Alles wordt op je apparaat opgeslagen, niet in de pagina.
