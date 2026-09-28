# Använda Lolly

En praktisk guide till att faktiskt *använda* appen - att öppna ett verktyg, arbeta med arbetsytan, exportera, spara och dela. Allt här körs **på din enhet**: inget konto, ingen uppladdning, och inget internet behövs för de skärmar du redan har öppnat.

> Ny här? [Snabbstart](/info/quickstart.html) får dig att skapa på några minuter, och [Lolly för operatörer](/info/operators.html) beskriver hur du installerar/driftsätter appen; den här sidan handlar om att använda den när den väl är öppen.

## Öppna ett verktyg

Startskärmen är **galleriet** - alla verktyg, grupperade efter kategori. Klicka på ett kort för att starta något nytt i det verktyget; [sparat arbete](#saving-continuing) öppnas igen från **Projekt**. Använd sökrutan för att filtrera efter namn - eller [Sök](/info/search.html) från fältet längst ner i de sex listvyerna (galleriet, Utilities, Projekt, Tillgångar, Översikten och Inställningar), som når ditt sparade arbete, dina tillgångar och dina inställningar lika väl som verktygen. Inne i ett verktyg drar sig fältet undan för verktygets egen ram.

![Ett gallerikort med exempel på navigering och åtgärden + Ny](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Varje verktyg är en delad vy: **kontroller** på ena sidan, en live **förhandsvisning** (arbetsytan) på den andra. Ändra en kontroll så uppdateras förhandsvisningen omedelbart.

![Ett verktygs delade vy - kontrollstapeln till vänster, och det levande grupperade stapeldiagrammet det ritar till höger](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Några verktyg (som **Design**) öppnas istället som en **fri arbetsyta** - en kromfri yta för direktmanipulation där du drar, ändrar storlek på, roterar och snäpper fast rutor med text, former och bilder, och dubbelklickar för att redigera text direkt på plats. Den exporteras via samma renderingsväg som alla andra verktyg, så arbetsytan *är* filen. Se [Den fria arbetsytan](#the-free-canvas-design) nedan.

Två sätt att forma själva rutnätet till det du vill ha:

- <!--i:star--> **Stjärnmärk det du använder.** ★ ett kort så får det en egen stor ruta i en rad ovanför rutnätet - se [Dina favoriter](/info/favourites.html).
- <!--i:eyeoff--> **Dölj ett verktyg du aldrig använder.** Högerklicka på ett kort (eller markera flera och använd markeringsfältet) → **Dölj verktyg**. Det försvinner ur rutnätet, och ur det som en sökning i rutnätet hittar; en grå ruta, **Visa dolda verktyg (N)**, allra sist tar fram dem igen, nedtonade, var och en med **Visa verktyg igen** i sin egen meny. Att dölja gäller bara ditt rutnät - verktyget öppnas fortfarande från en sparad länk eller ett bokmärke, och det ligger kvar precis där det var för alla andra.

![Slutet av verktygsrutnätet med de dolda verktygen framtagna: det nedtonade kortet QR Code Generator, och bredvid det den grå ruta som växlade tillbaka det i vyn, som nu läser Dölj dolda verktyg](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

För att agera på flera kort samtidigt, kryssa i varje korts kryssruta, dra en markeringsruta över tom yta eller **Shift/Cmd-klicka**, så visas ett flytande åtgärdsfält. **Vad markeringsfältet erbjuder** skiljer sig lite mellan vyerna, eftersom inte varje åtgärd är meningsfull överallt:

- **Verktyg / Utilities:** Favorit (eller Ta bort favorit), Dölj (eller Visa igen), Tillgänglig offline (eller Ta bort från offline), **Visa sessioner** (öppnar Projekt och visar bara de sessioner som gjorts med de verktygen) och Kopiera länk när exakt ett kort är markerat.
- **Tillgångar:** Favorit och Dölj gäller vilken markering som helst; Duplicera, Ladda ner och Radera visas bara när varje markerat objekt är en av dina egna uppladdningar - en delad designsystemtillgång är ett permanent kontrakt, så de tre stannar borta från den även i bulk.
- **Projekt:** se [Hitta och återfå ditt arbete](/info/find-your-work.html#find-something-you-saved).

> En etikettfälla: **Visa sessioner** finns bara när något är *markerat*. Att högerklicka på ett enskilt omarkerat kort erbjuder i stället **N sparade sessioner**, vilket öppnar en lista över det verktygets sparade sessioner, där en radering flyttar sessionen till Papperskorgen i stället för att navigera till Projekt.

![Galleriets urvalsfält för två verktyg, som erbjuder Tillgänglig offline, Visa sessioner, Favorit och Dölj](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

### Fråga Lolly

När du hellre vill fråga än leta tar **Fråga Lolly** (`#/ask`) emot en skriven fråga och lämnar tillbaka det avsnitt av den här dokumentationen som matchar, **ordagrant** - guidernas egna ord, inte en sammanfattning och inte en generering - med sidan det kom från angiven och en länk **Öppna i dokumentationen** bredvid. Under svaret ligger de platser i appen som samma fråga matchar: ett verktyg, en inställning, ett sparat projekt, var och en som en knapp som helt enkelt tar dig dit.

Utskriften är sessionsminne: ställ en följdfråga så byggs tråden upp allteftersom, ladda sedan om så börjar den från början. Sökresultaten har en rad längst ner, **Fråga Lolly: *din fråga***, under de konkreta träffar som de andra grupperna hittade, som lämnar över frågan direkt, så att du kan börja i fältet och avsluta här.

## Arbetsytan (förhandsvisning)

Förhandsvisningen visar alltid exakt det som kommer att exporteras.

**Dator**

- **Zoom:** Cmd/Ctrl-scroll, eller nyp ihop på en styrplatta - zoomningen centreras kring pekaren.
- **Panorera:** håll ned **blanksteg** och dra, eller dra med **mittenmusknappen**. (Vanliga klick är fortfarande fria för att klicka på delar av designen.)
- **Tangentbord:** `0` = anpassa till fönster · `1` = 100 % · `+` / `−` = zoom.
- **Zoom-HUD:** den lilla kontrollen `−  NN%  +  Fit` i hörnet. Klicka på procentsatsen för att växla Anpassa ↔ 100 %.

![Zoom-HUD:en i hörnet av arbetsytan - minus, den aktuella procentsatsen, plus, Anpassa, sedan reglagen för tema och ljud](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Pekskärm**

- **Nyp ihop** för att zooma, **dra** för att panorera, **dubbeltryck** för att återställa till anpassad vy.

**Klicka för att hoppa till en kontroll:** klicka på valfritt element i designen så får motsvarande inmatningsfält i sidopanelen fokus och rullas fram i vyn - för en upprepande radgrupp fälls exakt den rad du klickade på ut, så att redigera det du ser bara är ett tryck bort.

En ändring av måtten återställer alltid vyn till en ren anpassning.

### Den fria arbetsytan (Design)

Verktyg med fri arbetsyta lägger till en arbetsyta *runt* ritytan, som en formgivares arbetsbord:

- **Mellanlagring utanför ytan.** Dra en ruta förbi ramens kant så förblir den helt **synlig och valbar** - parkera element vid sidan medan du arrangerar kompositionen och dra sedan tillbaka dem. Allt utanför ramen är **lätt nedtonat** så att exportområdet alltid går att uppfatta med en blick, och ramen behåller sin skugga för att markera exakt var filen börjar.
- **Bara ramen exporteras.** Den exporterade filen begränsas av ritytan - allt som lämnas utanför (eller den del av en ruta som hänger över kanten) beskärs helt enkelt bort ur resultatet, i både raster- och vektorformat.
- **Zooma ut förbi Anpassa** (ner till 20 %) för att se hela arbetsbordet när du har placerat saker långt utanför ramen.
- **Ritytan kan ändra storlek.** Att ändra exportmåtten ändrar storlek på ramen på plats; rutorna behåller sina positioner, så du kan omrama en layout kring befintligt innehåll.
- **Innan du exporterar.** Inspektörens Dokumentavsnitt kontrollerar den sparade lagerstrukturen och läser sedan av den färdigställda arbetsytan efter avklippt text och kontrast mellan enfärgade ytor. Den frågar också samma typsnittsregister som används vid konturering för SVG/PDF om varje textrad har inbäddningsbara typsnittsbytes; bild- och gradientbakgrunder anges som visuella kontroller i stället för att få en påhittad kontrastpoäng.

![Designs fria kanvas - ritytan med den omgivande arbetsytan runt om](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

**Vänd en markering.** Högerklicka på valfri box och välj **Vänd horisontellt** eller **Vänd vertikalt** för att spegla den på plats, eller tryck `Shift+H` / `Shift+V` på tangentbordet - Shift, eftersom ett rent `V` är Pekarverktyget. Varje markerad box speglas på sin egen axel i ett enda ångra-steg, och spegelvändningen är en riktig transform, så den håller i den exporterade SVG:n, PDF:en och PNG:n snarare än bara på duken.

### Lager och Inspektör

I **Lager** är varje rityta en hopfällbar föräldragrupp. Välj dess namn för att hoppa dit, fäll ut dess lager och välj eller ändra ordning på objekt inom den ritytan. Växla till **Sidor** för miniatyrer och sidordning. Piltangenterna flyttar genom lagerlistan; Vänster återgår till ritytans rubrik.

**Inspektören** sätter text- eller bildkontroller först för det markerade objektet. Använd alternativchips för snabba val och fäll ut **Advanced** för formateringsdetaljer. På telefoner öppnar du **Inspektör** från **Fler åtgärder**. Kontrollerna öppnas i ett ark; Escape eller Tillbaka stänger det medan markeringen behålls.

### Rita egna former (pennan)

Rutor, cirklar och rundade ramar räcker för de flesta layouter. När du behöver en form som inte finns i listan ritar du den: knappen **Penna** i listen (eller tangenten `P`) sätter dig i ritläge. Tre enkla tangenter växlar mellan lägena - **`V`** tillbaka till Pekaren, **`P`** för Pennan, **`N`** för nodverktyget (**Redigera punkter**) - och Pekaren är alltid vägen ut ur det läge du står i.

![Den fria arbetsytans verktygslist: ett draghandtag, Lolly-menyn, sedan Pekare, Lägg till en ruta, Penna, Redigera punkter, Linje, Tidslinje, Ritytor och Ordna automatiskt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Klicka** för att placera en punkt. Med standardkurvtypen drar **klicka och dra** ut punktens handtag, vilket är så du ritar en kurva i stället för ett hörn - håll ned **Alt** när du klickar för ett skarpt hörn i stället. (Med de andra kurvtyperna är varje placerad punkt ett hörn och draget gör ingenting; se **Splinetyp** nedan.)
- Punkterna fäster mot ritytan och mot dina andra rutor när du placerar dem, och ritar samma hjälplinjer som ett vanligt drag gör. Alt stänger av rutnätet medan du ritar, och både rutnätet och kanterna när du drar en punkt efteråt.
- **Klicka på din första punkt** för att sluta slingan och avsluta i ett drag. Annars trycker du på **Enter**, dubbelklickar eller byter helt enkelt verktyg - teckningen behålls, den kastas inte.
- **Escape** tar ett steg i taget: första trycket överger teckningen och skriver ingenting, och ett andra lämnar pennan.
- **Delete** medan du ritar tar bort den senast placerade punkten.

Resultatet är en vanlig ruta på arbetsytan. Flytta den, ändra dess storlek, rotera den, gruppera den, justera den, stapla om den, ge den en fyllning, en gradient, en skugga eller en opacitet - en bana beter sig som varje annan ruta, och ingen av de kontrollerna behandlar den annorlunda.

Den kommer färdigmålad också. Den första banan du ritar får den fyllning och det streck ditt varumärke ger en bana, och därefter får varje ny bana **det du senast använde** - ställ in en fyllning en gång och fortsätt rita, i stället för att färga om varje form. (I ett verktyg vars varumärke inte säger något om banor får en ritad bana det streck du såg den ritas i, så den är aldrig osynlig.)

**Redigera punkterna igen.** Dubbelklicka på formen (eller använd **Redigera punkter** i objektfältet) så kommer punkterna tillbaka. Dra en punkt för att flytta den, dra ett handtag för att rikta om det, klicka var som helst på kurvan för att lägga in en punkt, dra en markeringsram runt en grupp punkter och tryck på Delete för att ta bort de markerade. En bana behåller alltid minst två punkter, så du kan inte råka radera bort den helt.

**Splinetyp** avgör vilken sorts kurva som löper genom dina punkter, och det är det val som är värt att förstå:

| Typ | Vad den gör |
|---|---|
| **Mjuk (auto)** | Standardvalet. Räknar ut sina egna handtagslängder, så enkelt klick-klick-klick ger en verkligt mjuk kurva utan handtagsfipplande. Om du ändå ställer in ett handtag låser det *riktningen* och kurvan behåller ägandet av längden. |
| **Bezier-handtag** | Den klassiska pennan. Handtagen är kontrollpunkterna, och att lägga in en punkt flyttar aldrig kurvan. |
| **Genom punkterna** | Går exakt genom varje punkt du placerat, inga handtag. |
| **B-spline** | Flyter nära punkterna i stället för genom dem, för en mjukare form. |
| **Raka linjer** | En polylinje. |

Att byta en befintlig bana till en typ som räknar ut sina egna handtag frågar först, eftersom de handtagslängder du ställt in inte går att få tillbaka - att byta till **Bezier-handtag** är alltid förlustfritt. Mitt i en teckning kommer ingen fråga: bytet tillämpas direkt på utkastet, och de handtag du redan dragit ut följer med. På de typer som äger sina handtag ändrar en inlagd punkt kurvan mycket lite; på **Bezier-handtag** gör den det inte.

Varje punkt bär också en kontinuitetsregel, som syns på dess form på arbetsytan - fyrkantig för **Hörn** (handtagen rör sig oberoende), rund för **Mjuk** (handtagen håller sig i linje), rund med ring för **Symmetrisk** (i linje och lika långa). Ställ in den för valfria markerade punkter så uppfyller kurvan den omedelbart igen.

![Två pennbanor renderade direkt från en länk: en S-kurva med streck och en sluten fylld klump](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

En ritad bana följer med i länken som allt annat, så en form du ritar öppnas igen från en delningslänk och renderas identiskt från CLI:t. Ingenting hos den är beroende av redigeraren.

### Kombinera former (banoperationer)

Markera två eller flera former, **högerklicka** på arbetsytan (tvåfingertryck på pekskärm) så erbjuder menyn de operationer du väntar dig av ett ritprogram:

- **Union** slår samman dem till en form och behåller den översta formens färgsättning.
- **Subtrahera** skär bort allt ovanför från den nedersta formen.
- **Snitt** behåller bara överlappningen.
- **Uteslut** behåller allt utom överlappningen.

Tre till fungerar på en enskild form: **Konturstreck…** gör om ett streck till en fylld form med samma kontur (bra när du vill behålla en tjocklek exakt som den ritades), **Förskjut bana…** växer silhuetten utåt eller, med ett negativt tal, krymper den inåt och **Förenkla** bygger om en bana med färre segment men samma form.

![En månskära och en ring med ett riktigt hål, båda framställda med Subtrahera](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Resultatet är en ny bana som du kan fortsätta redigera med pennan. Hål är riktiga hål - kontrollen **Fyllningsregel** i streckpanelen avgör om överlappande konturer fylls (*non-zero*) eller stansar igenom (*even-odd*).

Två saker gör de här operationerna medvetet inte. De **vägrar hellre än förstör**: be om ett snitt mellan två former som inte överlappar så får du veta att det inte finns något att behålla, och ingenting ändras. Och text- och bildrutor har ingen kontur att arbeta med, så de lämnas i fred i stället för att approximeras av sin ram. Ett kombinerat resultat lagras som vanliga Bezier-kurvor, vilket är vad ett ritprogram också gör - den ursprungliga splinetypen överlever inte operationen.

### 3D-scener

Välj **3D-scen** i verktygslistens läggtill-meny och dra ut en ram: 3D Studio öppnas direkt på den nya rutan, och det du ställer in där kommer tillbaka till arbetsytan. På alla andra sätt är en scenruta en helt vanlig ruta. Flytta den, ändra dess storlek, rotera den, ge den en skugga, lägg den på en bild eller på tidslinjen, och den beter sig som alla de andra.

**En scenruta behåller receptet, inte en bild.** En bildruta rymmer en renderad fil; en scenruta rymmer en enda inställning, själva scenen, skriven som 3D Studios egen länkfråga, där varje värde som fortfarande ligger på studions standard utelämnas. Det är därför en scen väger omkring hundra byte snarare än de kilobyte ett helt recept kostar, därför samma sträng fungerar i en delningslänk och i redigerarens dörr, och därför en ny studiokontroll inte kräver någon ändring i Design. Det är också därför rutan renderas om vid vilken storlek och vilket ögonblick dokumentet än behöver, i stället för att förstoras från en bild tagen tidigare. Bilder en scen använder förblir tillgångar och reser via id, så en uppladdning inuti en scen hamnar i en `.lolly`-fil tillsammans med resten av dokumentet.

**Redigera den i studion.** Markera rutan så visar Inspektören ett avsnitt **3D-scen**: en rad som namnger vad scenen är gjord av, en andra som namnger dess ljusstudio när du väl har valt en, och en knapp, **Redigera i 3D Studio**. Knappen öppnar studion på den rutans scen med alla kontroller verktyget har. Tillämpa, så skrivs den redigerade scenen tillbaka som ett enda steg, så en ångring återför rutan till scenen du började med; stäng studion utan att tillämpa och inget ändras. Allt annat om rutan - dess plats på ritytan, hur stor den är, dess skugga, när den anländer på en bild - ligger kvar i de avsnitt den alltid använt. En scenruta tar ingen egen bild och ingen bildtext: dess bild kommer från studion, och dess ord ställs in där också.

**En levande scen, en affisch på varje annan ruta.** Varje 3D-ruta i ett dokument visar en affisch: en stillbild av scenen, ritad utanför skärmen genom den delade renderarpoolen i den storlek rutan upptar. Ett dokument med tjugo scener kostar en ritningskontext, inte tjugo. Markera en scenruta och den blir dokumentets enda levande scen; avmarkera den och den ram som var på skärmen blir dess affisch, så inget hoppar till. Bara en scen är levande åt gången, och att markera två scenrutor samtidigt lämnar båda som affischer. I den här utgåvan är den levande scenen till för att titta på, inte för att kretsa runt: ändra en scen via **Redigera i 3D Studio**. En enhet som inte kan öppna en flyttalsgrafikkontext behåller affischen och säger varför inuti rutan i stället för att visa en tom rektangel, och resten av dokumentet påverkas inte. Att öppna ett Design-dokument utan någon 3D-ruta laddar ingen 3D-kod alls.

**På tidslinjen** följer en scenruta spelhuvudet som ett videoklipp: dess start, klipp-in och hastighet flyttar scenen genom sin egen animation, och scenens längd är den du ställt in i 3D Studio, så att korta av en ruta visar mindre av scenen i stället för att snabba upp den. Bara den markerade scenrutan är levande; alla andra är stillbilder, och en stillbild går inte att skrubba.

**Vid en export** ritas varje scen på nytt i den storlek filen behöver, genom samma renderare som studion använder. En video renderar en bildruta per scen per ögonblick; en PNG, SVG eller PDF bäddar in en bild per ruta i rutans egen pixelstorlek. Inget fotograferas från skärmen, så en export beror inte på vilken ruta du hade markerad. En scen som inte kan ritas gör att exporten misslyckas och talar om varför, med studions egna ord.

**Att dela en scen byggd på din egen uppladdning.** En delningslänk för ett Design-dokument bär en enhetslokal uppladdnings-id inuti en scen som den står, där en bildruta i stället tömmer den. Så en scen vars grafik eller modell är en fil du laddat upp visar studions standard för den bilden på någon annans enhet, om inte dokumentet reser som en `.lolly`-fil, som bär med sig byten.

## Tidslinje (Sequence)

**Sequence** är Designs tidslinje: den lägger till *tid* på den fria arbetsytan. Varje ruta kan starta vid ett ögonblick, pågå en viss längd och animeras in och ut, och en tidslinje dockad under ritytan är där du arrangerar dem. Öppna den och det spelar redan en sekvens - ett titelkort, ett klipp, ett slutkort, en nedre tredjedel och en musikbädd - så modellen syns innan du ändrar något.

![Sequence-tidslinjen: transporten, linjalen, ett overlay-spår, den magnetiska sekvensraden med dess klipp och skarvchips samt Always on-remsan](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Det finns två sorters rader, och skillnaden är hela idén:

- **Sekvensraden** är *magnetisk*. Klippen ligger utan glapp, ett efter ett, och att dra ett omordnar följden i stället för att lämna ett hål. Ta bort ett klipp så sluts leden. Det här är din ryggrad.
- **Överläggsbanor** är fria. En nedre tredjedel, en logotyp, en bildtext - allt som svävar över ryggraden vid sin egen tid - får en egen bana och en egen start.
- Under dem samlar **Alltid på** de rutor som inte har någon tidsättning alls: kuliss som helt enkelt finns med hela vägen. `+` på en bricka lyfter upp en på en bana; **Gör alltid på** skickar tillbaka den.

![Redigeringsläget: ritytan i förgrunden och centrum, verktygsraden till vänster och zoom-HUD:en i hörnet](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Att öppna tidslinjen ger den tangentbordet, så blanksteg och piltangenterna styr spelhuvudet i stället för sidan - och eftersom den öppnas av sig själv för en komposition som redan har tidsättning gäller det från det ögonblick Sequence laddas.

> **[Sekvensredigeraren](/info/sequence-editor.html)** går djupare in på de fyra saker som avgör om redigering i tid känns förutsägbar: vilket klipp ett klick på arbetsytan redigerar, lökskalsskuggor av grannklippen, delningens omfattning och den Sammanfogning som ångrar ett snitt samt trimning (inklusive tangentuppsättningen). Tryck på `?` med tidslinjen i fokus för genvägsbladet.

**Redigering.** Dra i mitten av ett klipp för att flytta eller omordna det, dra inom några pixlar från endera änden för att trimma det och tryck på **Dela vid spelhuvudet** (eller `S`) för att klippa ett klipp i två. Delning kräver ett klipp med en riktig **Längd** och spelhuvudet en bit inne i det, så ett öppet klipp (musikbädden till exempel) går inte att dela. **Fäst mot kanter** är på som standard och fäster mot klippkanter, spelhuvudet och hela sekunder, med Alt för att åsidosätta. Varje drag är ett enda ångra-steg, och dragets förhandsvisning räknar likadant som verkställandet, så det du ser medan du drar är det du får.

Markera ett klipp så ger inspektören dig samma redigeringar som siffror: **Längd**, **Trimma in** (hur långt in i källan det startar), **Hastighet** som en uppsättning fasta multiplar från ×0,25 till ×4, **Animera in** / **Animera ut** med sina längder och **Stäng av ljud för klipp**. Ett klipp på den magnetiska raden har med flit inget **Start**-fält - raden äger ordningen, så du drar för att flytta det.

**Övergångar** är förinställningar, inte nyckelbilder: Tona, Pop, Väx, Höjning, Släpp, de fyra Glid-varianterna, Zooma in och ut, Lutning, Svep, Snurra, Drift eller **Klipp (ingen animering)**. Avstånden skalar med objektet, så samma förinställning läser rätt på ett helskärmskort och en liten bricka. Mellan två intilliggande klipp på sekvensraden finns en **skarvbricka**: klicka på den och välj **Klipp** eller **Övertoning**, som tillämpas direkt och stängs. Öppna samma bricka igen för att ändra **Längd (ms)** och tryck på **Klar**. En övertoning lagras som en uttoning av det ena klippet och en intoning av det nästa, och den faktiska övertoningen härleds ur det paret: det första klippet fortsätter att spelas förbi snittet och tonar ut medan det nästa tonar in under det. Förhandsvisningen och filen följer samma regel, så det du ser vid skarven är det du exporterar.

**Ljud.** Lägg till ett **Ljud**-klipp så lever det på tidslinjen som vilket annat klipp som helst: vågform, trimning, ljud av. (Den genererade bädden som standardsessionen levereras med är det enda undantaget - den syntetiseras vid exporten, så dess stapel förblir tom och tyst tills du renderar.) Tryck på mikrofonen för att **spela in en speakerröst** direkt på tidslinjen, med nedräkning och nivåmätare, och tagningen sparas som din egen resurs vid den punkt där du började. Tryck på kameran bredvid för att **spela in en video** på samma sätt: tagningen beskärs till ritytans exportstorlek medan den spelas in, så den lilla självbilden visar exakt vad som hamnar i sekvensen vid spelhuvudet, i helbild - sättet att hämta in en kollegas klipp från en delad länk. Musik, dialog och ett klipps eget ljudspår når alla den exporterade mixen. (Exportpanelens **Ljudspår** är något annat: en bädd lagd under hela klippet, med toning och ducking. De två samexisterar.)

**Ljudremsan.** Markera ett klipp som bär ljud så öppnas en kompakt remsa under tidslinjen: ett **Volym**-reglage, **Panorera** för stereoposition, en tregradig **EQ** (**Låg**, **Mellan**, **Hög**), en **Tonhöjd**-kontroll som transponerar i halvtoner medan rösten behåller sin karaktär, och **Normalisera volym**, som för klippet till sändningsljudstyrka (BS.1770) så att en tyst röstanteckning och ett högt spår hamnar på samma nivå. Där två klipp möts blandar **Övertoning** ihop skarven i stället för att klippa. Ett **Effekt**-fack kör bearbetning på enheten på klippet - **Röstrensning** tar bort rummet och suset ur en inspelning. Hastighetsändringar behåller också tonhöjden: ett klipp som saktas ner eller snabbas upp tidsstretchas i stället för att bli tonhöjdsförvrängt. Vid varje mix duckar exporten musiken under talet allteftersom talet kommer och går och håller hela programmet under en true peak-begränsare, så inget klipper på vägen ut; en vågform som skulle ha klippt ritas med en varning där det händer.

![Tidslinjen med musikklippet markerat: panelen längs botten visar Hastighet, Toningar, Volym, Panorera, EQ, Tonhöjd, Normalisera volym och Effekt-facket](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Att rendera det.** En rörelseexport är en **deterministisk komposition**, inte en skärminspelning - varje bildruta avkodas, ritas och kodas vid en exakt tidpunkt, så filen är inte beroende av att din maskin hänger med, och det finns inget praktiskt tak för antalet bildrutor i MP4 eller WebM. Tidslinjens egen längd sätter varaktigheten om du inte skriver in en. Content Credentials stämplas som vid varje annan export. En stillbildsexport ger dig bildrutan vid spelhuvudet, eller ett helt kontaktark via fältet **Bildrutor** bredvid utdatastorleken - se [Exportera](/info/exporting.html#stills-from-a-timed-composition).

Några begränsningar att ha i minnet: en sekvens är begränsad till en timme, GIF och animerad PNG buffrar sina bildrutor så att de förblir korta, ett klipp som spelas snabbare eller långsammare behåller sin tonhöjd (ljudremsan tidsstretchar det, och en **Tonhöjd**-kontroll transponerar i halvtoner med röstens karaktär bevarad) och **Spela in live** är dolt här eftersom kompositören är den bättre vägen.

**Bortom förinställningar: nyckelbilder, djup och en kamera.** En övergång animerar ett klipp när det kommer in och lämnar. För att posera en ruta *inuti* ett klipp - driva den, tona den, sudda den, lyfta den från sidan och landa den igen - lägg till nyckelbilder: markera klippet, tryck **+Nyckelbild** (romben i tidslinjens verktygskluster, romben på ritytans objektfält eller `K`) och spelhuvudets position avgör vilken pose din nästa ändring skriver. Samma nyckelbildssystem ger varje tidsstyrd komposition en **kamera** som zoomar in, panorerar och drar fokus och förvandlar en platt SVG till en stapel lager du kan flyga mellan. **[Animering](/info/animating.html)** är den fullständiga guiden.

Verktyget Design har samma tidslinje, så du kan tidsätta en layout utan att byta verktyg, och det exporterar rörelse också.

## Presentera

För att placera din kamera, en logotyp och en namnbildtext över publikbilden, använd **Present with camera**. Dess egna kontroller, sparade scener, delning och inspelningssteg beskrivs i [Presentera med kamera](/info/presenting.html). De vanliga presentationskontrollerna nedan finns fortfarande tillgängliga via **Presentera**.

Ett Design-dokument som består av **ritytor** är redan en presentation. Öppna **Lolly-menyn** i verktygslisten och välj **Presentera** - den sista raden - så blir varje rityta en helskärmsbild, i den ordning ritytorna ligger på arbetsytan. Presentationen körs på en kopia av de renderade ritytorna, så redigeraren under rörs aldrig och när du lämnar är du tillbaka exakt där du var.

- **Gå framåt** med **Space**, `→`, **Page Down** eller ett klick på fältet vid skärmens högerkant; gå bakåt med `←`, **Page Up** eller fältet vid vänsterkanten. **Home** och **End** hoppar till första och sista bilden. Ett litet kontrollfält tonar in när du rör pekaren och döljer sig igen när du slutar.
- **Översikt** (`O` eller rutnätsknappen) lägger ut alla ritytor på en gång i den ordning du gav dem på kanvasen; klicka på en för att öppna den.
- **Visningssteg.** Högerklicka på en box och välj **Visa vid steg 1**, **2** eller **3** istället för standardvalet **Alltid synlig**. Den boxen väntar sedan tills du går vidare till dess steg, så en bild kan komma i delar; boxar som delar ett nummer kommer samtidigt.
- **Talarvyn** (`S`) öppnar ett andra fönster med den aktuella bilden, nästa bild, dina anteckningar för den bilden och en löpande klocka. Om webbläsaren blockerar popup-fönstret faller det tillbaka till en panel ovanpå presentationen. Anteckningar anges per rityta och visas aldrig på själva bilden.
- `B` håller kvar en svart skärm (valfri tangent tar tillbaka bilden), `F` återgår till helskärm och **Escape** skalar av ett lager i taget: översikt tillbaka till presentationen, presentation tillbaka till redigeraren.
- **Kiosk.** Ge en rityta en **Längd** så håller presentationen kvar där så länge, och går sedan vidare själv bakom en tunn förloppsindikator; `K` (eller pausknappen, som bara visas när något har en längd) stoppar och startar om det. Lägg till `kiosk` i länken så loopar presentationen på slutet, vilket är det som gör den till skyltning.

- **Understapling av bilder.** Högerklicka på en rityta och välj **Stapla under föregående bild** så blir den ett steg i den bilden i stället för en egen bild: översikten visar ett kort, presentationen går igenom stapeln i ordning, och inspektörens rad **Stapla** anger vilken bild den hör till.
- **Morfa.** När två på varandra följande bilder båda har en ruta med samma **Morfmatchning**-namn (högerklicka på en ruta, eller inspektörens rad **Morfmatchning** - till exempel `hero`), flyttar övergången den rutan från där den var till där den är, med storleks- och färgändring på vägen, i stället för att klippa. En presentationsomfattande övergång **Morfa** gör samma sak för varje matchat par.
- **Uppläsning.** **Talarens anteckningar** för varje rityta kan läsas upp. I inspektörens avsnitt **Dokument** väljer du en **Röst**, eventuellt en andra röst att **Blanda med**, uppläsningens **Hastighet**, samt en **Intro** och **Svans** i millisekunder runt varje bild; slå på **Visa undertexter vid presentation** så visas orden medan de sägs. Rösten körs på din enhet. Samma anteckningar blir filmen i en videoexport, riktigt bildljud i en PowerPoint-export, och den berättade filmen inuti ett [SCORM-paket](/info/create/exporting.html#scorm-course-packages).

![Inspektörens Dokumentavsnitt: Röst, Blanda med, Hastighet, Intro, Svans och Visa undertexter vid presentation](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Presentationen är också en länk. `?present` öppnar direkt i den, `s=` anger bilden - en position, ett rityte-id eller `id.step` för ett byggsteg - och adressen uppdateras när du förflyttar dig, så det du skickar är den bild du står på. Verktygsförfattare: de parametrarna dokumenteras på sidan [URL-läge](/info/url-parameters.html#reserved-parameters).

## På en telefon

På smala skärmar flödar layouten om till en kolumn:

- **Kontrollerna blir ett ark** högst upp med ett **draghandtag** på nederkanten. Dra i handtaget för att ändra storlek - det snäpper till **skymt / halv / full** - eller **tryck** på handtaget för att växla mellan hopfällt och expanderat. Förhandsvisningen fyller utrymmet nedanför och förblir synlig medan du redigerar.
- En flytande **Exportera**-knapp öppnar exportarket - alla kontroller för format, storlek, kopiering, sparande och nedladdning på ett ställe. Stäng det genom att trycka på bakgrunden.

![Ett verktyg på en telefonbred skärm - kontrollerna som ett ark högst upp, den genererade paletten som fyller förhandsvisningen nedanför och renderingsknappen som svävar nedtill i mitten](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Kontroller (inmatningar)

Verktyg exponerar bara de inmatningar som är avsedda att varieras - allt annat (färger, layout, typografi, logik) är låst av verktygets upphovsperson, så det du gör uppfyller de regler som upphovspersonen har satt. Inmatningarna omfattar text, reglage, färgväljare, rullgardinsmenyer, datum, bildväljare och upprepande radgrupper. Vissa är grupperade under hopfällbara avsnitt.

![Ett verktygs kontrollstapel - ett textfält, färgväljare och ett reglage och inget annat som upphovspersonen valde att låsa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Återställ:** *Rensa ändringar* återställer varje inmatning till dess standardvärden.

### Ångra och gör om

**Cmd/Ctrl-Z** går ett steg bakåt och **Cmd/Ctrl-Shift-Z** (eller **Cmd/Ctrl-Y**) går framåt igen. Samma par sitter som knapparna **Ångra** och **Gör om** i raden ovanför kontrollerna - på den fria arbetsytan ligger de i verktygslisten i stället - och var och en gråas ut när det inte finns något kvar att ta tillbaka. Varje steg säger vad det var: ångra en färg så namnger ett litet meddelande den inmatning som just återställdes, med en **Gör om**-knapp i sig för vägen tillbaka.

- **Ett drag är ett steg.** Upprepade ändringar av samma kontroll inom en halv sekund slås ihop, så att dra ett reglage över hela sitt spann blir en enda ångring i stället för tvåhundra.
- **De senaste 100 stegen sparas** - äldre faller av i slutet. Att göra en ny ändring efter en ångring rensar framåtstacken, precis som överallt annars.
- **Medan markören står i en textruta** tillhör Cmd/Ctrl-Z fältet självt, tecken för tecken. Lolly tar över för de kontroller som inte har någon användbar egen ångring: reglage, rullgardinsmenyer, färger och strömbrytare.
- **Att välja en fil** i en **fil**-inmatning är inget steg - de byten hålls bara för sessionen, så det skulle inte finnas något att lägga tillbaka.

I ett live-[samarbete](/info/collaborate.html) förblir historiken din egen. En ändring som kommer från den andra enheten hamnar aldrig på din stack, så ångra kan bara någonsin ta tillbaka något du själv gjorde.

Ångra går bara tillbaka genom det här besöket; verktyg som sparar medan du arbetar behåller också tidigare versioner under **Historik**, bredvid **Ångra** (se [Gå tillbaka till en tidigare version](/info/find-your-work.html#go-back-to-an-earlier-version)).

## Dina uppgifter och profilbild

**Inställningar** (uppe till höger i galleriet, som visar ditt förnamn när du väl har angett ett) innehåller ditt namn, dina kontaktuppgifter och en valfri **profilbild**. Verktyg som efterfrågar dessa fält fyller i dem automatiskt - ange dem en gång så fylls din e-postsignatur, dina lockups och dina märken i av sig själva. Du kan fortfarande skriva över valfritt fält per session. Kryssa i **Använd mina uppgifter för att skapa** så följer dina uppgifter med som upphovsperson på det du exporterar.

Din profilbild och dina uppgifter finns **bara på den här enheten**. En profil kan vara mer än bara du - ett team eller en roll du kliver in i då och då. Se **[Profiler](/info/profile.html)** för hela bilden, inklusive hur du behåller fler än en.

## Spara och fortsätta

För att behålla ditt arbete trycker du på **Spara som**, bocken bredvid **Exportera**. Under **Save to a project** lämnar du **Mitt bibliotek** markerat eller väljer ett projekt (**＋ Nytt projekt…** skapar ett), och trycker sedan på **Spara**. Att spara igen uppdaterar samma objekt i stället för att skapa en kopia. I Design ligger **Spara som** i menyn under Lolly-logotypen; på en telefon, tryck på **•••**, sedan **File menu**, sedan **Spara som**.

Knappen **Spara** i exportpanelen gör samma sak med ett klick och laddar aldrig ner en fil: nytt arbete hamnar i Mitt bibliotek, och arbete du sparat tidigare uppdateras där det ligger.

För att komma tillbaka senare trycker du på **Hem** uppe till vänster och öppnar sedan fliken **Projekt** (en mappikon på en telefon). Sparningar i Mitt bibliotek ligger på flikens första skärm; ett projekt är en mapp där. Objekt är namngivna efter filnamnet du skrev i exportpanelen, eller annars efter sitt verktyg, till exempel **QR Code**. Öppna ett och varje inställning finns där, redo att ändras och exporteras igen.

Sparat arbete finns kvar på den här enheten, i webbläsaren eller appen du sparade från, om du inte slår på [Synk](/info/sync.html). En fil du får med **Ladda ner** är en färdig kopia; för att ändra den senare öppnar du det sparade objektet i Projekt. Om något inte finns där du förväntar dig, se [Hitta och återfå ditt arbete](/info/find-your-work.html).

![Den tvådelade renderingsknappen - en uppåtpil som öppnar exportpanelen och en bock märkt Spara som, som öppnar sparaarket](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projekt

**Projekt**, fliken **Projekt** högst upp på startskärmen, håller allt du har sparat, i mappar du skapar. Att hitta, sortera och söka i ditt arbete där, och att återställa ett objekt från **Papperskorg**, finns på [Hitta och återfå ditt arbete](/info/find-your-work.html#find-something-you-saved).


## Dela ditt arbete

En design går ut på ett av två sätt: som en länk eller som en fil. Dialogrutan Dela erbjuder båda. Öppna den med **Dela** i exportkontrollerna; **Dela länk** på en sparad session i Projekt öppnar samma dialogruta för den sessionen.

### Länken

Varje inmatning fångas i sidans URL, så en länk *är* designen. Överst i dialogrutan sitter länken redo att kopieras, med två hopfällda avsnitt under sig.

- **Länkalternativ** innehåller **Öppna i den installerade appen** (byter fältet till en `lolly://`-URI för Genvägar, startprogram och automation, med varje parameter oförändrad), **Kortaste länk** (en stor design ger en lång URL, så det här packar hela tillståndet i en kompakt token och visar dig besparingen i tecken; den läsbara formen finns alltid kvar också), **Lösenordsskydda den här länken** (AES-256 över hela länken, lösenordet aldrig i den) och **Fäst den här verktygsversionen** - flaggan `_v`, som spikar fast länken vid den verktygsversion du tittar på så att en senare uppdatering inte kan ändra vad den renderar.
- **Länkbeteende** är vad som händer när mottagaren öppnar den: helskärm, exportpanelen redan expanderad, nedladdning-vid-öppning med `&export` eller kopiering-till-urklipp med `&copy`.

Klistra in länken till en kollega, bokmärk den eller checka in den. (Fullständiga detaljer: [URL-läge](/info/url-mode.html).)

**Vissa verktyg gör länken till hela produkten.** Jump Page samlar dina länkar på en sida att dela ut - en bio-länk, ett konferenstal, en butiksfasad. Det finns inget att hosta och inget konto bakom: sidan är länken, så den öppnas lika snabbt som URL:en färdas. I redigeraren ser du den färdiga sidan bredvid fälten; en besökare som öppnar länken får den i full bredd, en länk per scen medan de scrollar.

![Jump Page i redigeraren: rubrikscenen överst på sidan, med länkscenerna under](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Dialogrutan säger vad en länk inte kan bära.** Tre saker får inte plats i en URL: en bild eller fil du lagt till från den här enheten, ett mycket långt textvärde eller en mycket stor lista. Var och en räknas medan länken byggs. Om något har måst utelämnas namnger dialogrutan det och pekar dig mot filen nedan, i stället för att ge dig en länk som öppnas med bilden saknad. En länk som bara är *lång* får en mildare notis med sitt teckenantal, eftersom packning fortfarande kan rädda längd.

### .lolly-filen

`.lolly` är Lollys filändelse för portabla paket, inte ett löfte om att varje fil innehåller samma sak. `format` i `manifest.json` är det som avgör. Appen läser den lilla manifestfilen först och visar storlek, innehåll och åtgärd innan den skriver något:

- En **delad design** (`lolly-share`) innehåller en sparad verktygssession, dess inbäddade filer och ett kvitto för allt som fortfarande löses upp via referens. Den kan också bära med sig verktyget och det designsystem som användes för att skapa den. Att öppna den lägger till ett nytt projekt; den skriver aldrig över en befintlig session.
- Ett **delat projekt** (`lolly-share` med typen `project`) innehåller en mapp från Projekt: dess undermappar, varje sparad session arkiverad i dem, varje sessions kort och bilderna arkiverade där. Att öppna den lägger till en kopia av hela mappen i Projekt; inget som redan finns ersätts. En Lolly från innan projektfiler fanns kan inte läsa en sådan och ber dig uppdatera.
- Ett **designsystempaket** (`lolly-brand`) innehåller tokens och kan innehålla typsnitt, logotyper, publicerade versioner och bevarade resurser. Att öppna det lägger till det som ett separat namngivet designsystem och byter sedan till det; system som redan finns på enheten finns kvar.
- En **varumärkesarbetsyta/instanspaket** är en `lolly-brand` med deklarerade verktyg, katalogtillgångar och eventuellt en instansadress. Förhandskontrollen listar dessa enhetsomfattande effekter, eftersom att läsa in den ersätter den enda tidigare inlästa arbetsyteöverlagringen.

En fullständig **enhets-/profilsäkerhetskopia är inte en `.lolly`**. Den förblir en `LollyTools-….zip` med formatet `lolly-backup`, och återställs via **Inställningar → Lagring → Importera data…**, som också tar en kopia Synk håller i din lagring. En vanlig zippad verktygsmapp förblir också `.zip`. Med andra ord äger session- och designsystempaket `.lolly`; säkerhetskopior och lösa arkivarbetsflöden gör det inte.

**Download .lolly**, i dialogrutan Dela i det verktyg du arbetar i, skriver den aktuella designen som ett delat designpaket. Det bär den sparade sessionen tillsammans med de bilder och filer som finns tillgängliga på den här enheten. Vanlig katalogkonst följer också med. Licensierad konst hålls tillbaka om du inte uttryckligen inkluderar den, och en föråldrad eller otillgänglig fil förblir en extern referens i stället för att försvinna. Det förberedda kvittot visar den faktiska `.lolly`-storleken, antalet inbäddade filer, antalet externa referenser och om verktyget är inkluderat. Där din enhet har ett delningsark lämnar **Skicka till…** den filen direkt till det (AirDrop, en Android-delning) i stället för att spara den på disk.

**Download project (.lolly)**, i en mapps meny i **Projekt**, skriver den mappen som ett delat projekt, så att någon annan kan öppna det och fortsätta med varje session i det. Varje session reser som sin egen del (`sessions/<key>.json`, med sitt kort under `thumbs/`), mappträdet listas i `manifest.json`, och uppladdningar och katalogkonst reser under samma regler som en enskild delad design. Batch-sessioner är inte verktygssessioner och blir kvar; meddelandet anger hur många. **Ladda ner original**, bredvid den, är oförändrad: en vanlig zip av varje objekt som sin egen fil.

En `.lolly` är en vanlig zip. Byt namn på den till `.zip` och öppna den: dina egna bilder ligger under `assets/uploads/` och katalogmaterial under `assets/catalog/`, var och en med sitt riktiga namn och sin ändelse, `manifest.json` listar varenda en och en README överst berättar vad filen är.

Tre saker är dina att avgöra innan den går i väg:

- **Om ditt namn tas med.** Ditt namn, e-post och organisation skrivs in i filen endast när **Use my details to create** är påslaget i din profil. Med det avstängt noterar filen att den gjordes med Lolly och när - inget om dig.
- **Om licensierad konst tas med.** Licensierade och varumärkeslåsta tillgångar hålls tillbaka som standard. Om designen använder några säger dialogrutan hur många och erbjuder två knappar - *Download without them* eller *Include and download* - eftersom att inkludera dem ger de faktiska filerna till den som öppnar `.lolly`-filen.
- **Om verktyget tas med.** **Include the tool** packar verktygets egna filer tillsammans med designen, så att den öppnas på en enhet som inte har det verktyget. Det anländer förbockat för ett anpassat verktyg - en fork eller ett privat varumärkesverktyg din mottagare sannolikt inte har - och avbockat för ett verktyg som den signerade katalogen listar, eftersom deras kopia kommer från samma källa. (På en build utan signerad katalog räknas varje verktyg som anpassat och rutan börjar förbockad.)

**Att öppna en.** I en installerad dator- eller mobilapp dubbelklickar eller trycker du på en `.lolly`, väljer **Open with Lolly**, eller skickar den till Lolly från systemets delningsark. macOS, Windows, Linux, iOS och Android registrerar alla formatet; datorernas filhanterare visar den som ett Lolly-dokument (och GNOME Files kan visa en sparad sessions egen miniatyrbild). I webbappen använder du **Öppna** eller släpper filen på Lolly. Varje ingång använder samma manifestbaserade förhandskontroll. Att öppna från Brand Studio rekommenderar designsystemåtgärden när en delad design bär ett sådant, men det byter aldrig namn på filen eller döljer **Öppen gemensam design**.

Ett iOS- eller Android-dokument som lämnas över från en annan app är begränsat till 48 MB, eftersom den inbyggda överlämningen måste kopiera sina byte över appgränsen. Mobilappen säger det i stället för att tyst ignorera en alltför stor fil. **Öppna** inuti Lolly använder inte den överlämningen; det är vägen att prova för ett större paket.

Efter bekräftelse packar den valda läsaren upp och verifierar paketet en gång. En delad designs tillgångar går till ditt bibliotek, dess session går till Projekt och dess verktyg öppnas när det är tillgängligt. Ett delat projekts sessioner går till Projekt under en ny kopia av dess mappar, med nya id:n så att samma fil kan öppnas två gånger, och mappen öppnas; en session vars verktyg den här enheten saknar väntar där. En tillgång som redan finns på enheten matchas via checksumma och återanvänds. Ett designsystempaket lagras i sitt eget namnrymd innan appen byter till det. Filer över 100 MB pekas ut som stora, och förhandskontrollen varnar när webbläsarens lagring rapporterar mindre ledigt utrymme än den deklarerade nyttolasten behöver. Varje integritetsskyddad del kontrolleras innan åtgärden slutförs; en skadad kopia avvisas och den nyskapade destinationen återställs.

Om filen bär ett verktyg du inte har frågar Lolly innan det verktyget får köras: **Litar du på det här verktyget?** namnger det och dess upphovsperson och säger rakt ut att öppna det kör verktygets egen kod på din enhet, med **Lita på och installera** som vägen vidare. Tackar du nej sparas det delade arbetet ändå i dina projekt och väntar där tills den dag du lägger till verktyget. (En sorts verktyg går ännu inte att sidoladda - ett vars kod levereras som en modul - och det avvisas på samma sätt.)

En länk och en fil lämnar båda över en ögonblicksbild. För att arbeta i samma session *samtidigt* som någon annan - två enheter, ingen server, ingen internetanslutning behövs om ni är på samma nätverk - se [Arbeta tillsammans](/info/collaborate.html).

## Live-kamera (rörelsereaktiva verktyg)

Varje **filter** för foto - Halvton, Skanlinje, Posterisera, Voronoi-celler, Färgbehandling, Pixelsträckning och Ofullkomligheter - visar en knapp **Gå live** där en kamera finns tillgänglig. Slå på den så följer effekten din webbkamera bildruta för bildruta, så att den reagerar på rörelse; du kan spela in resultatet som GIF, WebM eller MP4. Bildrutor läses och bearbetas **på din enhet** och lämnar den aldrig, och kameran släpps så fort du stoppar eller lämnar verktyget. (Varje bildväljare har också **Ta ett foto** för att fånga en enstaka bildruta som en bild på enheten.)

## Mina bilder

När ett verktyg låter dig lägga till en bild från din enhet behålls den exakt som den kom in - så en Content Credential på den verifieras fortfarande - och sparas i ditt personliga bibliotek **Mina bilder** (under **Inställningar → Lagring**). Bara en verkligt enorm fil frågar om den ska behållas eller skalas om. Återanvänd den i vilket verktyg som helst. För att rensa bort EXIF/GPS när bilder kommer in, slå på **Ta bort metadata från uppladdningar** i din profil. Det finns inget tak: biblioteket är helt lokalt och begränsas bara av enhetens lagring - hantera eller ta bort bilder där.

## Tillgångar - ditt bibliotek

**Tillgångar** (`#/a`, eller segmentet **Tillgångar** i växlaren Verktyg · Utilities · Tillgångar · Projekt överst i varje listvy) samlar allt dina verktyg kan använda - varumärkeslogotyper, bilder, ljud och rörelse, grupperade efter typ - och det är också här dina **egna kreativa filer** bor. Ingen server, ingen adminkonsol, ingen pull request: allt finns på din enhet.

![Tillgångar, med varumärkets färgrutor och typsnitt samt dina egna uppladdningar](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Ta in dina filer.** Dra valfri bild, SVG, ljudklipp, video, Lottie, PDF eller PowerPoint-presentation till uppladdningsytan - eller klicka för att välja - så hamnar den i Tillgångar direkt, redo i varje verktygs resursväljare. En flersidig PDF eller en `.pptx` frågar vilka sidor eller bilder som ska behållas - var och en blir en SVG-resurs. Mata in så mycket du vill; det lämnar aldrig din enhet.
- <!--i:star--> **Favoritmarkera det du använder ofta.** ★ en resurs (eller ett varumärkessvatch) och den fästs överst i varje väljare, så din stående logotyp eller färg är ett klick bort.
- <!--i:folder--> **Städa upp.** Omkategorisera en resurs till en annan grupp, dölj en delad varumärkesresurs du inte använder (med **Visa dolda** för att ta tillbaka den) eller ta bort dina egna uppladdningar helt. Samma gest för flervalsmarkering och svävande åtgärdsfält som i Projekt fungerar här också, så allt det kan göras på ett helt urval samtidigt.
- <!--i:layers--> **Lyft en video från dess bakgrund.** Öppna en videos detaljvy eller högerklicka på dess kort i valfri resursväljare och välj **Ta bort bakgrund…** för att spara ett transparent alternativ - en animerad WebP eller PNG med riktig alfa. Välj en **Metod**: en **modell på enheten** klipper ut ett motiv ur en händelserik scen, eller en **färgnyckel** som nycklar bort en jämnt belyst, platt bakgrund som en greenscreen eller en enkel vägg, med **Tolerans**, **Mjukhet** och **Spilleliminering** för att finjustera kanten. Färgnyckeln behöver ingen modellhämtning och inget nätverk, så **Ta bort bakgrund** erbjuds för alla videor och är ofta renare på städat material. En **Upplösning**-kontroll (360, 480, 720 eller 1080p, aldrig förbi källan) byter detalj mot en mindre, snabbare fil. Det körs som ett bakgrundsjobb på din enhet. Den färdiga urklippningen sparas bredvid originalet som sin egen resurs och källvideons Content Credential följer med som en ingrediens. (Se [Genererat en gång, renderat likadant](/info/ai-features.html) för varför att ta bort en bakgrund förblir en vanlig redigering.)

### Ta med din palett och dina typsnitt vart som helst

Panelen **Färgrutor** i Tillgångar gör mer än att visa - klicka på en färg för att kopiera den, eller **ladda ner hela varumärkespaletten** i det format ditt andra verktyg talar:

- <!--i:code--> **Designtokens (JSON)**, **CSS-variabler** eller **CSS-klasser** - släpp in varumärket direkt i en stilmall eller ett bygge;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - läs in det i Illustrator eller Photoshop;
- <!--i:pentool--> **GIMP-palett (.gpl)** - för GIMP eller Inkscape.

![Panelen Färgrutor - de fem nedladdningsknapparna för paletten längst upp, sedan varje varumärkesfärg som en kopierbar bricka](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Panelen **Typsnitt** listar dina varumärkessnitt med en **nedladdning** bredvid varje, för att installera lokalt eller lämna till ett tryckeri. (Rummet Färger i [Brand Studio](/info/brand-studio.html) erbjuder samma palettnedladdning.)

Tillgångar är den ena halvan av den öppna gör-det-själv-vägen; den andra är att **skapa dina egna verktyg** - den fria arbetsytan (Design, beskriven ovan) låter dig bygga ett visuellt, utan kod.

## Ljud och tillgänglighet

Lolly strävar efter att vara bekvämt att använda för alla. Gränssnittet är tangentbordsnavigerbart, anpassade kontroller har korrekta etiketter för skärmläsare och varje verktygs live-förhandsvisning exponeras som en enda märkt bild som beskriver vad den skapar.

Ett skonsamt lager av **hjälpljud** bekräftar det du gör - att komma in i galleriet, en giltig kontra ogiltig Content Credentials-kontroll, att stänga en panel, att byta filter. Det är **avstängt som standard**: slå på **Ljud** var som helst reglaget visas (varje vys alternativpopover, eller **Inställningar**), så kommer valet ihåg.

Fyra valfria bekvämlighetsinställningar finns under **Inställningar → Tillgänglighet**: **Minska rörelse** (tar bort appens övergångar och utsmyckningar), **Dölj färgstarka förhandsvisningar** (lugna gallerikort med ikon och text, och tystare projektminiatyrer), **Hög kontrast** (starkare kanter, text och fokusringar) och **Stor text** (större apptypografi - etiketter, menyer, knapptext). Alla fyra lugnar appen *runt* ditt arbete: de når aldrig in i ett verktygs arbetsyta eller ändrar en pixel av det du exporterar, och var och en är av tills du slår på den. Fullständiga detaljer i [Din profil → Tillgänglighet](/info/profile.html#accessibility).

Bredvid Ljud-reglaget finns **Neurospicy Mode** - ett valfritt, lugnande fokusspår i bakgrunden som spelas tyst medan du arbetar. När du slår på det öppnas en liten **spelardocka** i det nedre hörnet som följer med dig genom appen; därifrån kan du söka efter och välja ett spår, hoppa framåt och bakåt, ställa in volymen samt minimera eller stänga den. Spårlistan omfattar några kategorier - procedurella *Lolly Sings*-låtar, ambienta loopar och beats, ditt eget uppladdade ljud och en handfull direktsända **radio**stationer från internet (dessa kräver en anslutning; allt annat spelas offline). Det är **avstängt som standard** och, precis som Ljud, kommer det ihåg mellan sessioner och enheter. Att stänga av Ljud tystar även fokusspåret.

## Lagring och integritet

Lolly håller ditt arbete på din enhet: i den här webbläsarens egen lagring i webbappen, och i appens egen lagring i skrivbords- och mobilapparna. Vad som sparas, vad **Rensa all min data** tar bort och vad rensning av webbläsardata tar med sig finns på [Hitta och återfå ditt arbete](/info/find-your-work.html#if-you-clear-your-browser-data); [Integritetspolicyn](/info/privacy.html) listar allt appen hämtar eller skickar, och [Serverns yta](/info/server-surface.html) de valfria serverkomponenterna.

## Flytta till en annan enhet

För att ta med ditt arbete till en andra dator eller telefon, använd Synk, en säkerhetskopia eller en `.lolly`-fil. [Flytta ditt arbete till en annan enhet](/info/find-your-work.html#move-your-work-to-another-device) jämför de tre och går igenom **Exportera mina data** och **Importera data…**.

## Importera en design (Figma, Penpot, Illustrator, InDesign)

Du kan ta in en befintlig design i Lolly och fortsätta arbeta med den: öppna **Design**, klicka på **Importera en design** i arbetsytans verktygsfält och välj en Figma **.fig** eller SVG, en Penpot **.penpot**, en Illustrator **.ai** / **.pdf** eller en InDesign **.idml**. Lager blir redigerbara rutor på den fria arbetsytan - text förblir omskrivningsbar, bilder hamnar i **Mina bilder** och typsnitt och färger anpassar sig till varumärkets globala inställningar - sedan sparas, delas och renderas resultatet som vilken annan session som helst. Tolkningen sker helt och hållet på din enhet. Fullständiga detaljer: **[Importera en design](/info/design-import.html)**.

## Exportera

Se **[Exportera och format](/info/exporting.html)** för hela historien - att välja ett format, utdatastorlek och tryckenheter, transparens, video och kopiera/dela. Kort sagt: välj ett format, ställ in storleken om du behöver och **Ladda ner** (eller **Kopiera** till urklipp).

## Batch-läge (Pro)

För avancerade användare renderar **Batch** (länkad från galleriet, spärrad bakom Pro-funktionsflaggan, som är påslagen som standard) många varianter på en gång - ett rutnät där varje rad är en uppsättning inmatningar, exporterade tillsammans. Perfekt för att lokalisera ett kort till ett dussin språk eller generera varje storleksvariant i en enda omgång. Fyll i rader genom att skriva, klistra in direkt från ett kalkylblad eller importera en CSV-fil (du kan även exportera en tillbaka), och ställ in format, storlek och utdatafilnamn per rad. Spara ett helt rutnät som en namngiven **batch-session** som öppnas igen från galleriet, och ladda ner varje rad som en enda `.zip`.

![Satsverktygsfältet - zip-namn, enheter, DPI och formatet varje rad ärver, med Sessioner och Rendera till höger](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch är till för att generera **många varianter av en mall** på en gång. För att rendera om sessioner du **redan har sparat**, använd **Projekt → Rendera mapp / Rendera markering** (se [Hitta och återfå ditt arbete](/info/find-your-work.html#find-something-you-saved)) - ingen Pro-funktion behövs.

## Redigera sida vid sida (Multiredigering)

Sats är många varianter av *en* design. **Multiredigering** är den andra halvan av arbetet: flera **olika** sparade designer öppna samtidigt, så att en ändring gäller för alla. Kryssa i mellan **två och åtta** sparade sessioner i **Projekt** och välj **Redigera tillsammans** i urvalsfältet; de öppnas som levande kort sida vid sida på `#/multi?s=<slot>,<slot>…`. Varje kort är en riktig rendering av den sessionen, inte en sparad miniatyr, så det du ser är det som exporteras.

En enda sidopanel styr alltihop:

- <!--i:sliders--> **Gemensamma** leder den - varje inmatning som två eller flera av de markerade sessionerna deklarerar på *samma sätt* (samma id, samma typ, samma villkor - samma sammanslagningsregel som batch-rutnätet använder på sina kolumner). Redigera en gemensam kontroll en gång så sprids värdet till varje session som deklarerar den, direkt på varje kort. Två sessioner från samma verktyg delar allt; två olika verktyg delar bara de fält de har gemensamt.
- <!--i:document--> Under den ligger **ett hopfällt kort per session** med alla den sessionens egna fält, med samma trohet som verktygets egen sidopanel - tillgångsväljare, upprepande radgrupper, färgfält - plus ett kompakt exportblock: **Format**, **B** / **H**, **Enhet**, **DPI** och en egen **Ladda ner**. Den nedladdningen sparar sessionen först och renderar den sedan via den vanliga sessionsexportvägen, så filen bär samma filnamn, format och Content Credentials som den skulle direkt från verktyget.
- <!--i:search--> **Filtrera fält…** högst upp smalnar av kontrollerna på *varje* kort samtidigt - vilket är så du hittar "rubriken" i åtta sessioner utan att rulla efter den.

Klicka på valfri arbetsyta (eller tryck på Enter på den) så öppnas den sessionens kort i sidopanelen och rullas fram i vyn. **Spara alla** skriver tillbaka varje session till sin egen plats. **Ladda ner alla** sparar först och renderar sedan hela uppsättningen genom samma pipeline som Projekts **Rendera markering** - en zip, med det valfria lösenordslåset erbjudet på vägen.

Två ärliga begränsningar. Taket på två till åtta är verkligt: varje kort monterar sin egen levande körtid, och det är det antal som förblir följsamt - en länk som ber om fler (eller om en session som inte längre finns) säger det i stället för att ladda halvvägs. Och länken namnger *dina* sparade platser, så den öppnar den uppsättningen på den här enheten; det är ingen delningslänk.

När markeringen är större än åtta, blandar verktyg eller innehåller bilder såväl som sessioner är nödutgången **Redigera som blad** i samma markeringsfält: den öppnar hela markeringen som **rader i batch-rutnätet** (`#/pro?s=…`), utan storleksgräns och utan krav på samma verktyg. Mappar står utanför båda - de har sin egen väg att öppnas i rutnätet. ([Sök](/info/search.html) är det enda som ännu inte når in hit: Multiredigering är den enda vyn som sökfältet inte känner till.)

## Offline och installation

Lolly är en PWA. Den fortsätter fungera **offline** på de skärmar du redan har öppnat, och **Appen** under **Inställningar → Tillgänglig offline** laddar ner resten - installera den från webbläsarens adressfält (eller *Lägg till på hemskärmen* på mobilen) för en app-liknande, helskärmsupplevelse. Den uppdaterar sig själv när du är uppkopplad igen.

Om uppdateringar: om en vy någonsin skulle misslyckas att laddas precis efter en (en tom panel, ett "failed to fetch" i hörnet), ladda om sidan en gång - appen tar upp den nya versionen felfritt och ditt sparade arbete, dina sessioner och ditt varumärke förblir orörda; bara en bild du lagt till men aldrig sparat kan behöva läggas till igen. Den lagrar allt på din enhet, inte i sidan.

Design och Darkroom kan behålla bildens ursprungliga precision med **Wide colour / HDR**-redigering, inklusive Sequence-video. Varumärkets färgrutor kan bära separata sRGB- och P3-värden. Se [Bred färgåtergivning och HDR-redigering](/info/hdr-editing.html) för utdataval och nuvarande begränsningar.
