# Lolly Design System Setup

<a id="design-system-setup"></a>

Din logotyp, dina färger och dina typsnitt hör hemma på ett ställe, så att varje verktyg, sida och export ritar med dem. Det stället är **Lolly Design System Setup**, på `#/start`.

Börja med det du har. Släpp in en logotyp så läser Lolly dess färger. Välj ett typsnitt, eller släpp in typsnittsfilen som ditt företag licensierar. Varje ändring syns genom hela appen direkt. Din logotyp, dina typsnitt och dina tokens stannar på den här enheten. Att välja ett Google Font är det enda steget som når ut: Lolly frågar först och hämtar sedan familjen en gång.

När det ser rätt ut ger du designsystemet ett namn och trycker på **Export**. Du får en `.lolly`-fil att behålla, öppna på en annan enhet eller ge till en kollega. [Lolly Settings](/info/dashboard.html#design-system) visar det aktiva systemet skrivskyddat, och dess omslag länkar hit för redigering.

## Gör det till ditt på fem minuter

::: timeline
- <!--i:upload--> **Släpp din logotyp** på släppytan i **Logos**. Lolly läser dess form och dess färger.
- <!--i:palette--> **Använd de här färgerna.** Logotypens huvudfärg blir din primärfärg, och en mörk neutral från logotypen blir din textfärg.
- <!--i:font--> **Välj ett typsnitt** i **Type**: ett Google Font, eller en typsnittsfil du äger.
- <!--i:pentool--> **Döp systemet.** Din första redigering skapar ett eget designsystem, och Lolly frågar en gång efter dess namn.
- <!--i:download--> **Export** skriver hela systemet som en `LollyBrand-….lolly`-fil.
:::

Fältet längst upp i studion bär designsystemets namn, och namnet är ett fält du kan ändra när som helst: **Enter** behåller ett nytt namn och **Escape** sätter tillbaka det gamla. När din första redigering frågar **What is this design system called?** fylls orden från din logotyp i om logotypen stavar ut dem. **Save name** behåller namnet; **Not now** behåller en platshållare tills du skriver ett i fältet. Namnet märker systemet i Settings och när du byter, och blir namnet på filen **Export** skriver.

## Rummen

Studion är en uppsättning rum i ingen fast ordning: inget är numrerat och inget väntar på något annat. På ett skrivbord ligger rummen i en rad under fältet. På en telefon flyttar de till en rad längs nederkanten, där en tumme når dem, med det öppna rummet rullat i sikte; palettbladet och facket reser sig ovanför raden, och raden viker undan medan du skriver. Med tangentbord når Tab raden en gång, och piltangenterna, Home och End flyttar från rum till rum.

![Studions fält och dess rum: Board, Colours, Type, Logos, Tokens, Files, Rules och Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Rum | Vad du gör där | Länknyckel |
|---|---|---|
| **Board** | Se vad systemet håller, med en dörr in till varje rum | `overview` |
| **Colours** | Lägg till färger, ge dem roller, bygg nyanser och en palett | `color` |
| **Type** | Välj de fyra typsnitt som appen, verktygen och varje export läser | `type` |
| **Logos** | Placera dina märken i varje orientering och behandling | `logos` |
| **Tokens** | Hörn, avstånd, skuggor och varje annat namngivet värde | `tokens` |
| **Files** | Bild-, ljud- och rörelsefilerna ditt varumärke behåller | `catalogue` |
| **Rules** | Reglerna ditt varumärke tillämpar, kontrollerade på verkliga exempel | `usage` |
| **Skills** | Varumärkets skrivna riktlinjer för människor och agenter, att läsa och ladda ner | `skills` |

Länka till ett rum med `#/start?area=<key>`. Rummet Files behåller nyckeln `catalogue`, Board behåller `overview` och Rules behåller `usage`, eftersom en rumsnyckel är ett permanent kontrakt, och `?tab=` fungerar fortfarande som ett äldre alias. En okänd nyckel öppnar Board.

**Fältet** håller åtgärderna för hela systemet snarare än för ett rum. **Add from…** tar in ett varumärke ([Ta in ett varumärke](#bring-a-brand-in)), och **Tray** håller det en skanning hittade som du ännu inte lagt till. **Export** skriver systemet som en fil, och **More** håller **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** och **Design systems**, som öppnar listan i Settings där du byter ([Behåll och flytta ditt designsystem](#keep-and-move-your-design-system)). Var och en visas först när det finns något för den att verka på. På en telefon flyttar **Add from…** in i **More** och **Export** visas som sin ikon.

## Board

Utan något valt ännu erbjuder Board fyra sätt att börja. **Start from a reference** öppnar källväljaren för en logotyp, skärmbild, webbsida eller designfil, och **Pick a colour**, **Choose a face** och **Add a logo** öppnar de kontrollerna direkt. Att öppna en skriver ingenting, och **Explore the tools** finns där från start.

När något är ditt eget visar Board vad du har, med dina egna antal först. Colours anger antalet färger, med ett dämpat `· N starter` där ärvda färger visas; dess band lägger dina färger först, sedan en hårfin linje, sedan de bleka startfärgerna. Colourways visar varje colourway som en liten ruta i sin ledande färg. Type läses efter roll och sätter varje familj i sitt eget typsnitt (*Inter for headings*, med *Starter for the rest* på raden under). Logos säger hur många platser som är fyllda (eller **Not set**), Tokens visar hörnradien och Files säger **Nothing yet** medan biblioteket är tomt. Varje block öppnar sitt rum.

Ett designsystem som följde med appen och kan redigeras, till exempel Lolly Demo, har allt detta från start: Board visar dess färger, colourways, typsnitt och märken, med en tagg **Came with this app** vid rubriken.

### Starter och ditt

**Starter** är ordet för allt som kom med appen i stället för att väljas. En ny installation bär ingen färg alls, bara en neutral ramp från bläck till papper, så att ytor, text och hårfina linjer kan renderas innan någon bestämt något. Samma ord märker ärvt material i varje rum.

::: cols
## Starter

- Kom med appen: neutralerna från bläck till papper, starttypsnitten, standardhörnradien.
- Dämpat, med en **Starter**-tagg och ingen färgton.
- Räknas inte som dina färger. Neutralerna finns i **Tokens** som **Neutrals · starter · 9**, och **Open** visar dem i Colours som en hopfälld grupp (`#/start?area=color&group=neutral`).
- En roll som står på en startfärg lyder *"Starter Paper stands in"*, med **Choose…** på dess väljare.

## Ditt

- Valt eller installerat av dig.
- Full styrka, och ett färgat kort där du installerat ett typsnitt.
- Räknas på Board och i Tokens.
- En roll som följer en annan lyder **↳ follows Primary** i stället för att upprepa primärfärgens namn.
:::

Ärvt material ritas aldrig med streckad kant, eftersom en streckad kant här betyder ett släppmål.

## Loggor

Töm din mapp med märken i släppytan överst: **"Drop marks here, or choose several at once"** tar så många filer du har. Varje fil läses för sin form och sin färg och väntar sedan under **Waiting for a slot** som ett chip som säger hur den ser ut, till exempel *"Looks like the Horizontal primary"*, med måttet den använde och en **Place**-knapp (**Replace** där platsen är fylld). Där den är osäker säger chipet det och erbjuder **Change slot**, som listar alla åtta. Inget placeras förrän du trycker på något.

Ett märke med överflödig tom marginal får först ett erbjudande om beskärning; svara på det eller tryck Escape så går originalet in orört. Där ett märke kan fylla en tom syskonplats erbjuder rummet den härledda **mono**- eller **reverse**-versionen som ett chip märkt *Generated*.

Varje märke hamnar i ett rutnät med åtta valfria platser, en per **orientering** och **behandling**:

- **Orienteringar:** Horizontal (ordmärke och symbol på en rad) och Vertical (staplat, för kvadratiska och höga utrymmen).
- **Behandlingar:** Primary, Primary reverse (för mörka bakgrunder), Mono (en färg) och Mono reverse.

En grupp utan märken ännu viks till en rad; öppna den för att se dess platser. Klicka på en plats för att lägga till en PNG, SVG, JPEG eller WebP, eller klicka på en fylld plats för att ersätta märket. Allt stannar på den här enheten.

![Logoplatserna med Horizontal och Vertical öppnade: varje behandling är en plats för sig, och varje plats är valfri](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Anpassade märken** är märken som ditt varumärke kallar vid eget namn, som en ikon, ett vapen eller en favicon.
- **Fler identiteter.** Ett undervarumärke, en produkt eller ett event kan ha en egen full uppsättning: **+ Add another logo** och ge uppsättningen ett namn. Din huvuduppsättning är "Your logo". [Brand architectures](/info/brand-architectures.html) visar när en logotypidentitet är rätt block.
- **Lolly läser logotypens färger.** Ett kort under släppytan, och igen överst i Colours, listar logotypens färger och frågar **Which is the main colour?**, med den starkaste färgen redan vald (aldrig det vita den exporterades på). **Use these colours** lägger till dem i din palett, gör huvudfärgen till din primärfärg och, när logotypen har en mörk neutral som läses på papper, gör den till textfärg. **Not now** lämnar dem i Tray. På en alldeles ny installation tillämpas det troligaste svaret direkt, och kortet erbjuder **Undo** eller en annan huvudfärg. En SVG ger exakta färger; en PNG, JPEG eller WebP ger de färger som täcker en verklig andel av märket.

## Färger

Rummet växer med designsystemet: ett första besök är ett beslut, och resten kommer när paletten gör det.

### Den första färgen

Ett system utan egna färger visar startens neutrala färger, öppna i sin egen grupp, och högst upp i rummet ett streckat fält för att klistra in och släppa: ett stort chip och ett fält. Släpp en bild eller en lista med färger var som helst på fältet, så läser Lolly färgerna från det du släppte.

- **Chipet är väljaren.** Tryck på **Välj en färg** så öppnas studions OKLCH-kort, förifyllt med det fältet håller: färgens namn och hex först, med färgrymderna, hjulet, de fyra rattarna och alfa under **Finjustera**, och **Avbryt** och **Lägg till färg** längst ner. Ingenting når systemet förrän du trycker på **Lägg till färg**.
- **Fältet tar vilken notation som helst**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` eller ett färgnamn. Klistra in en lista så blir den en rad chips att lägga till en i taget eller med **Lägg till alla**.
- **Två vägar in till.** **Välj en färg från skärmen** använder pipetten där webbläsaren har en, och **Hämta färger från en bild** läser en skärmbild eller ett foto på den här enheten.
- **Lägg till är aldrig inaktiverad.** Med ett tomt fält öppnar den väljaren; text den inte kan läsa får en rad under fältet som säger det.

Din första färg blir **primärfärgen**, och ett chip bekräftar det, till exempel *"Primary is now Vivid Violet"*, med **Fine-tune** för att justera färgen.


### När paletten växer

Dina färger sitter bredvid en förhandsvisning **In context** på en bred skärm, och ovanför den på en mindre. Förhandsvisningen visar en affisch, ett diagram eller ett gränssnittskort i din palett. Startfärger stannar i sin egen hopfällbara grupp, som fälls ihop när systemet har egna färger, och fältet för att klistra in och släppa blir en kompakt rad. Export finns i fältets **Export** och i rummet Tokens, så rummets huvud har ingen.

![Rummet Colours på Lolly Demo: paletten i hopfällbara grupper, varje färg med sitt namn och hexvärde, och palettnedladdningen i huvudet](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Rummet Colours på Lolly Demo efter att en färg lagts till: tabellen Färgroller, sedan den nya färgens chip som erbjuder Använda som huvudfärg? och Finjustera, bredvid en levande kompositionsförhandsvisning](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roller: vad färgerna kallas

Designsystemet säger vad dess färger heter och vad var och en är till för, och Lolly läser det. **Colour roles** finns överst i rummet Colours. På en bred skärm delar **In context** vyn, så en ändring syns på affischen, diagrammet och gränssnittskortet medan du gör den.

![Tabellen Färgroller på Wefthouse, ett påhittat textilvarumärke, med egna ord: färgvariantchipsen Indigo, Madder och Weld, sedan Huvud, Accent, Supporting och Tertiary, var och en med sin ljusa och mörka färg, lästa som huvudfärgen, partnerfärgen och bara på namn, och Bakgrund, Text, Dämpad text och Hårfina linjer listade under tabellen som de avläsningar ingen roll fyller](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabellen har fyra kolumner, och på en telefon blir varje rad ett kort som håller ljust och mörkt sida vid sida:

| Kolumn | Vad den innehåller |
|---|---|
| **Roll** | Designsystemets eget ord, som du kan redigera direkt, och en rad som säger vad färgen är till för |
| **Ljust** och **Mörkt** | Färgen i det utseendet för den valda färgvarianten, med sitt namn eller värde, och sin kontrast |
| **Lolly läser detta som** | Vad ett verktyg gör med rollen, med Lollys egna ord |

**Hur Lolly läser en roll.** Varje avläsning tar en roll, så att välja en avläsning som en annan roll håller flyttar avläsningen hit. Lolly läser aldrig betydelse ur ett ord.

| Avläsning | Vad som följer av den |
|---|---|
| **Huvudfärg** | Stora former, knappar, den färg ett verktyg leder med |
| **Partnerfärg** | Den andra färgen ett verktyg tar till |
| **Bakgrund** | Ligger bakom allt annat |
| **Text** | Rubriker och brödtext |
| **Dämpad text** | Bildtexter och finstilt text |
| **Hårfina linjer** | Linjer, kanter och avdelare |
| **Bara vid namn** | Inget verktyg väljer rollen av sig självt. Den erbjuds i varje färgfält och i Design, där ett val förblir länkat, så det följer färgvarianten |

En avläsning som ingen roll fyller förblir som designsystemet definierar den, och rummet listar dem under tabellen. En roll som delar id med en avläsning, som en roll som heter Primary, är den avläsningen och kan inte flyttas.

**I ett diagram.** Paletten **Design system - colour roles first** i Lolly Chart ger serierna först designsystemets färgroller i dess egen ordning, sedan resten av dess palett. En roll som läses som bakgrund, text, dämpad text eller hårfina linjer lämnas utanför, eftersom diagrammet ritar sin botten och sina ord i de färgerna. Inget ändras förrän du väljer den paletten, och ett designsystem utan färgroller ritar paletten som **Design system - ordered**.

**Värden.** Tryck på ett värde för att välja en färg för den rollen, i det utseendet, i den valda färgvarianten. **Samma som ljust** gör att det mörka värdet följer det ljusa tills du väljer en egen färg. Chipet **Aa** visar den text Lolly väljer att placera på färgen, och raden under värdet säger hur den texten läses, per utseende: **Texten är lätt att läsa**, **Bara stor text** eller **Svår att läsa som text**. Det gäller text på färgen och säger inget emot själva färgen, som fortfarande kan fungera för former och stora ytor. En roll som läses bara vid namn visar samma ord utan varningsfärgen, eftersom inget verktyg placerar text på den av sig självt. Siffrorna bakom orden, APCA först och WCAG sedan, finns i verktygstipset och i väljaren. **Egen textfärg** märker ett värde vars fil anger textfärgen, som då behålls. **Kopierad** märker ett värde som kommer från en annan färgvariant eller från partnerfärgen och som ingen har valt ännu; **Behåll den här färgen** i väljaren avgör värdet.

**Startpunkter.** Ett designsystem utan egna roller visar dagens ord: Primary, Secondary, Surface och Text. Ingenting skrivs förrän du ändrar något. **+ Lägg till en roll** erbjuder **Primary, Secondary** eller **Main, Accent, Supporting, Tertiary** som förslag, eller vilka ord du skriver, med den avläsning var och en skulle få. De två första orden blir huvudfärgen och partnerfärgen. Verktygen ritar fortfarande med samma färger, och på ett system med en huvudfärg får den första färgvarianten sitt namn efter den färgen.

**Byta namn, ordna om, ta bort.** Ett namnbyte ändrar bara ordet, så allt som använder rollen fortsätter fungera. Dra en roll i dess handtag, eller tryck på Blanksteg på handtaget, använd piltangenterna och tryck på Blanksteg för att släppa. **Ta bort** säger vad som fortfarande använder rollen. När verktyg läser den låter **Ta bort och behåll de färgerna** varje avläsning behålla den färg den ritar nu. En husregel, en vägledningsgrupp, ett verktygsfält eller en annan token som använder rollen håller kvar den tills den användningen ändras. Ett sparat Design-dokument kan också använda en roll vid namn, och det kan Lolly inte se i tokenfilen: ett dokument som gör det rapporterar färgen som olöst.

**En handskriven fil.** Färger som en tokenfil håller och som ingen roll deklarerar listas under **I den här filen, ännu utan roll**, var och en med ett fält för ett ord och **Skapa en roll**. De fortsätter fungera vid namn i båda fallen. En token med siffror i namnet kan inte vara en roll, så den ligger kvar i filen och fortsätter fungera via sin sökväg. En post i filen som inte validerar visar tabellen utan kontroller och säger varför.

**Resten av rummet talar samma ord.** Chipsen, färgprovets rad **Använd som** och palettens grupp **Färgroller** använder alla designsystemets ord, och en färgrolls ruta öppnar sitt värde. Exporterade filer registrerar inget nytt om roller: färgerna i en rendering ändras eftersom tokens ändrades.

**Vart orden tar vägen.** Orden och beskrivningarna följer med designsystemet. Agenter läser dem i designbriefen, `lolly://tokens` och en varumärkessidas `AGENTS.md`, terminalen visar dem i `lolly system status`, och en varumärkessida listar dem i `brand.json` och mäter ett kontrastpar för varje roll. Varje exportformat behåller det det har plats för: DTCG- och Tokens Studio-filer behåller allt, `DESIGN.md` behåller orden och avläsningarna, och ett PowerPoint-tema behåller bara varumärkets ordning. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) har hela listan. Ord citeras alltid som designsystemets data och läses aldrig som instruktioner.

**Var en färg väljs.** Varje färgfält i ett verktyg och i Lolly Design leder med designsystemets roller, i dess egen ordning, med varje ord och vad färgen är till för synligt. **Aa** bredvid en roll väljer den färg som ligger på den rollen. Resten följer under **Andra färger**, utan en färgvariants egna kopior, på-färgerna och varje avläsning en roll redan fyller. Ett val förblir länkat till rollen och följer färgvarianten, fältet visar fortsatt ordet oavsett vilken färgvariant som är vald, och Settings och Tokens använder ordet också. Ett designsystem utan roller behåller det rutnät av färgprover det alltid haft.

### Varje färg ett verktyg läser

När **Colour roles** är stängd leder de första besluten rummet som chips, var och en visar färgen som spelar rollen och dess namn. På ett system utan egna ord är dessa **Primary**, **Secondary**, **Surface** och **Text**. Tryck på ett chip för att välja dess färg bland palettens egna färgprover. **Varje färg ett verktyg läser**, längst ner i **Colour roles**, har hela remsan.

Remsan visar de sju färger ett verktyg kan läsa: Primary, Secondary, Surface, Text, Muted, Edge och On primary, med designsystemets egna ord där det har sådana. Var och en spelar samma del i varje verktyg och export. Ingen av dem behöver anges (tre lösa färger är ett bra system), vilken färg som helst kan fylla en och avläsningen säger hur text läses, mätt mot ytan, APCA först. Varje rad visar en egen färg i full styrka, en startfärg som står in, eller **↳ follows Primary**.

On primary härleds från primärfärgen, lyder **Härledd** och har ingen väljare. Växlaren **Light** och **Dark** bredvid, och den bredvid **In context**, väljer vilket utseende remsan, paletten och förhandsvisningen visar.

Appens egen accent följer designsystemet som standard. Det är inställningen **Interface follows the design system** i **Settings → Appearance**; att stänga av den lämnar appens gränssnitt neutralt, medan verktyg, ytor och exporter följer designsystemet i båda fallen.

**Färgvarianter.** Ett designsystem kan hålla flera huvudfärger, var och en vald per stycke. Raden **Colourways** överst i **Colour roles** visar en chip per färgvariant, med **Default** på den kanoniska. **+ Add** startar en ny färgvariant från en av palettens färger. Välj en chip, så visar tabellen, remsan, paletten och förhandsvisningarna den färgvarianten; den valda färgvarianten kan byta namn, dupliceras, göras till standard eller tas bort. På ett system med färgvarianter behöver varje färgvariant sin egen primär- och sekundärfärg, och sin egen yta när färgvarianterna färgar bakgrunden, så de rollerna förblir inställda i färgprovsredigeraren. [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) har stegen och tokenformatet, och [Lolly Demo i bruk](/info/lolly-demo-in-use.html#colourways-on-real-work) visar färgvarianter på verkligt arbete.

### Hitta fler färger

Tre verktyg bygger på din primärfärg. De två första föreslår bara, och det tredje ersätter paletten efter att du granskat ändringen.

::: cols
## Utforska nyanser och harmonier

Välj en **Starting colour**, ett **Scheme** (Mono, Complement, Analogous eller Triad) och hur många **Shades** (3 till 20, standard 5). **Fine-tune** anger gränssnittsintensitet, kontrast och text på varumärket. Klicka på en nyans för att lägga till den, eller **Add 5 shades** för en grupp. Dina färger och roller blir kvar.

## Hitta matchande färger

Välj en **Harmony**: Complementary, Adjacent, Triad, Tetrad eller Analogous (med **Accents** från 2 till 5 och en **Angle** från 10° till 45°). Varje kandidat har ett genererat namn och **+ Add**, ett tryck per färg.

## Bygg om hela paletten

Ersätter paletten från en startfärg, efter en granskning av vad som ändras och vad som blir kvar. En kontrollpunkt tas först, och **Undo** erbjuds efteråt.
:::

Alla tre använder samma perceptuella färgmatematik (OKLCH) som motorn. I **Explore shades & harmonies** visar raderna **Primary**, **Neutral** och **Secondary** de föreslagna nyanserna, och **Theme preview** visar ljusa och mörka exempel med deras kontrastavläsningar.

![Tre föreslagna nyansgrupper, med individuella lägg-till-kontroller och en separat Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Genererade accenter, var och en med ett färgprov, ett automatgenererat namn, dess hex-kod och en Add-knapp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Att spara en genererad palett

Öppna **Rebuild the whole palette…** och tryck på **Preview full rebuild**. Granskningen räknar hur många roller som blir kvar som du tilldelade dem, hur många av dina egna färger som behålls och hur många nyanskurvor, tryckspärrar, dolda nyanser och gradientstopp som förankras om eller behålls. **Apply rebuilt palette** bekräftar; **Cancel** ändrar ingenting. Efteråt erbjuder kortet **Undo** med fokus på den, och kontrollpunkten som togs före bytet återställer hela systemet.

Ett system med färgvarianter behåller varje färgvariant genom en ombyggnad. Den kanoniska färgvarianten följer den nya startfärgen, och varje annan färgvariant behåller sina egna färger, sitt namn, sin ordning och sina inställningar. Granskningen listar vilken färgvariant som följer och vilka som behåller sina färger. Lolly bygger inte om ett system som kodar sina färgvarianter på ett sätt det inte kan redigera; kortet säger varför, och ingenting ändras.

### Expertavsnitten

Fyra hopfällda avsnitt sitter under förhandsvisningen och rollerna. Vart och ett öppnas direkt med `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), beskrivet ovan.
- **Shade curves** (`focus=curves`) formar om en ramp punkt för punkt, med separata kurvor för ljushet, kroma och nyans (L / C / H) och nyanserna ritas om medan du drar.
- **Contrast** (`focus=contrast`): **Contrast-lock** tonar om en ramp för att nå APCA-mål mot en bakgrund du väljer, och **Rotate hue** vrider hela rampen runt hjulet.
- **Print** (`focus=print`) anger vad primärfärgen blir i tryck: dess automatiska värde, ett fastlåst CMYK-bygge eller en namngiven accentfärg.

### Paletten och varje färgprov

Paletten listar dina färger i hopfällbara grupper, var och en med sin egen **+ Add**. Skapa och byt namn på grupper som du vill. En roll gör aldrig en andra ruta: en ruta som en roll pekar på bär rollens namn i stället, till exempel **Primary**. **Colour chart** under rutorna visar samma färger på OKLCH-**hjulet** (dra en punkt för att färga om, klicka på tomt utrymme för att lägga till ett färgprov) och i **Gamut**-diagrammet, som visar var det visningsbara området slutar. `#/start?area=color&focus=chart` öppnar diagrammet direkt.

![Färgpaletten, varje grupp fällbar, med palettnedladdningen i sitt huvud](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkeln är nyans, avståndet ut är kroma och gråtonerna följer en ljushetsskala nedför sidan](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klicka på ett färgprov för att öppna dess redigerare:

- **Byt namn** på färgprovet.
- **Ange färgen** på OKLCH-reglage, eller i **Hex**, **HSL**, **RGB** eller **CMYK**. Värdefältet läser och skriver i det aktiva rymden. CMYK sätter här skärmfärgen genom omvandling; för att låsa exakta färger, använd **Tryckersättningar**.
- **Sparas som** väljer hur färgprovet sparas: **LCH** (standard, perceptuellt och med brett omfång), Hex, RGB eller HSL.
- **Använd som** ger färgprovet en roll direkt, med designsystemets egna ord där det har sådana. Tryck på en markerad roll igen för att rensa rollen.
- **Tryckersättningar** (hopfälld): lås **CMYK** från **Auto** till exakta färgvärden, eller ange en **Spotfärg** med ett **Namn** (till exempel `PANTONE 186 C`), en valfri **Book** och en **Finish** för folie, prägling, blindprägling, spotlack, soft touch eller en stansning, vikning eller perforering. Ett tryckeri använder de här låsen när du exporterar en CMYK-PDF eller TIFF; se [Colour profiles](/info/exporting.html#colour-profiles).
- **I andra rymder** (hopfälld): ett värde per färgrymd, härlett eller skrivet av dig, och ett som du skrivit vinner vid export.

**Att radera ett färgprov** är säkert. Härledda nyanser och temaroller döljs, så inget som läser dem går sönder, medan färger du lagt till tas bort.

::: details Att arbeta med många färgprov
Varje färgprov har ett draghandtag. Dra för att ordna om inom en grupp, eller fokusera handtaget, tryck Space, använd piltangenterna och tryck Space igen för att släppa; Escape avbryter. På en telefon visar paletten fyra färger per rad och handtagen visas i läget Select, i stället för som en rad under varje färg. För att flytta färger mellan grupper använder du redigerarens kontroll **Group** eller markerar flera och använder **Move to**.

Markering behöver ingen separat växel. Fältet och kryssrutorna visas med den första markerade rutan och försvinner med den sista.

- **Dra på tom yta** för att rita en rektangel; varje ruta den rör vid går med i markeringen, över grupper. Ett hopfällt avsnitt lägger inte till något.
- **Shift-klick** tar ett intervall i läsordning, **Cmd/Ctrl-klick** växlar en ruta, och ett vanligt klick öppnar redigeraren.
- Varje grupprubrik har **Select all**, och **Cmd-A** med en ruta i fokus tar varje färg du äger, aldrig en startfärg.
- Rutnätet har ett enda tabbstopp: piltangenter flyttar, Shift-pilar utökar, Space växlar, Delete tar bort och Escape rensar. För att knuffa en kanal trycker du `l`, `c` eller `h` först.
- På en pekskärm trycker och håller du på en ruta för att starta en markering, och trycker sedan för att lägga till.

Fältet lyder **{n} selected**, sedan **Move to**, **Give a role** (varje färg tar nästa roll i tur och ordning), **Download** (markeringen i något av de sex palettformaten), **Duplicate** (en kopia av varje, placerad efter originalet), **Copy values** och **Delete**. En kopia öppnas direkt i redigeraren; flera förblir markerade. Ett Cmd/Ctrl-Z ångrar en hel samlad åtgärd.
:::

### Gradienter

Den valfria panelen **Gradients** bygger blandningstokens från paletten. Varje gradient har en förhandsvisning, 2 till 8 namngivna stopp och en vinkel. Ett stopp pekar på ett färgprov, så färga om färgprovet så följer gradienten. Blandningar körs i OKLCH.

Palettnedladdningarna (designtokens, CSS, SCSS, GIMP och Adobe Swatch Exchange) sitter i palettens huvud, bredvid dess rubrik. [Ta din palett och dina typsnitt med dig överallt](/info/using.html#take-your-palette-and-fonts-anywhere) beskriver varje format.

## Typsnitt

Utan ett eget typsnitt är rummet ett kort: **Primary**, satt i lässtorlek i typsnittet som tjänar det i dag, med en **Starter**-tagg, en **Choose for Primary**-knapp och raden *"Nothing installs until you choose one."* Rubriker, kod och kursiv följer primärfärgen tills du väljer dem; **Choose them separately** visar deras kort.

![Typografi-rummet med inget snitt valt än - ett kort i läsbar storlek, en Standard-tagg på det och en fylld Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Välj ett typsnitt så öppnas rummet i fyra rollkort, listan Fonts och ett levande specimen:

- **Primary**: brödtext, knappar och varje verktyg.
- **Headings**: visningstypsnittet för `h1` och `h2`.
- **Code**: ett monospace-typsnitt för kod och data.
- **Italic**: en äkta kursiv för betoning, citat och sidokommentarer.

Ett kort är färgat bara där du installerat det typsnittet. Dess knapp säger vilken roll den gäller: **Change Headings** på ett eget typsnitt och **Choose for Headings** överallt annars. Provraden bryts i stället för att klippas av. Inget på ett kort bekräftar något: knappen öppnar jämförelsescenen för den rollen.

![De fyra rollkorten synliga - vart och ett satt i det snitt som tjänar det, med en Standard-tagg där ingen valt ett och Italic som följer primärfärgen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Jämförelsevyn

Scenen öppnas inne i rummet, under kortet du tryckte på, och korten viks till en rad så att scenen syns på en telefons första skärm. Escape avbryter och återför fokus till kortet.

1. Tryck på **Choose for** och rollen på kortet.
2. Skriv ett familjenamn och tryck på **Preview**, eller tryck på en av de sex **Pinned**-familjerna under fältet.
3. Tryck på **Use this face**.

![Jämförelseytan öppen under sitt kort, med sökraden, de fästa familjerna och korten hopfällda till en enradsremsa](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Samtycke frågas en gång.** Första gången en förhandsvisning når Google Fonts förklarar en dialog: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** går vidare och kommer ihåg. **Cancel** lämnar kortet med texten *"Not fetched. Nothing was sent to Google."*, med sin egen **Fetch from Google**.

**Släpp en typsnittsfil på scenen** (TTF, OTF eller WOFF) för att förhandsvisa ett licensierat typsnitt du redan äger. Hur som helst stannar typsnittet på den här enheten, renderas offline i appen, verktygen och varje export, och följer med i designsystemfilen. Allt på Google Fonts levereras under en öppen licens (OFL, Apache eller UFL).

### Typsnitt på den här enheten

Panelen **Fonts** listar varje typsnitt på den här enheten och rollen det tjänar. Typsnitt du lagt till leder under **In the design system**, var och ett med sina roller och en radering. Starttypsnitten följer i en dämpad, hopfälld rad. **Add a face** öppnar jämförelsescenen för vilken roll som helst. Panelen **Type roles** visar ett levande specimen av varje roll med dess familj och tillstånd, som *Inter* eller *Inter · follows Primary*.

## Tokens

Tokens är de namngivna värdena bakom designsystemet: färger, typsnitt, logotyper, hörn och avstånd. Verktyg läser dem med namn, så en ändring här når varje verktyg på en gång.

![Rummet Tokens: huvudet med ett exempel från systemet och filåtgärderna, rutor som räknar varje sorts token, sedan färgparen med sina kontrastavläsningar](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Huvudet** ger ett exempel från ditt eget system (*Primary is Spearmint, #033633*) och filåtgärderna: **Download** (hela systemet som designtokens, eller paletten i fem andra format), **Copy CSS** och **Add from…** för att läsa tillbaka en JSON-fil.
- **Rutor** räknar varje sorts token och hoppar till dess avsnitt: Colours, Type, Logos, Shape and spacing, More och All tokens. De räknar vad varje avsnitt håller; ett avsnitt som bara håller det som följde med det tomma startsystemet bär en tagg **Starter**, och ett system som följde med appen räknar sitt eget material utan den. På en telefon bryts rutorna till två rader om tre.
- **Colours** börjar med paren som verktyg sätter ihop (text på yta, på primärfärg, dämpad på yta) med en APCA-avläsning i ljust och mörkt, och flaggar **Weak contrast** där ett par inte räcker. Sedan varje färggrupp: en ramp som en rad chips, andra färger med sitt värde och referensen som verktyg använder, som `{color.brand.spearmint}`. Tryck på en referens för att kopiera referensen. **Edit in Colours** öppnar en grupp i rummet Colours. I ett designsystem med [färgroller](#colour-roles-what-the-colours-are-called) kommer **Colour roles** först, med varje roll en gång i systemets egna ord och ordning. En roll har en färg för varje färgvariant och utseende, och de färgerna stannar hos rollen i stället för att visas som egna färger: ändra dem i tabellen Colour roles.
- **Type** och **Logos** listar typsnittet för varje roll och varje logotypplats, med **Edit in Type** och **Edit in Logos** när du har egna.
- **Shape and spacing** håller **Rounded corners** (`shape.radius`) och **Spacing rhythm** (`space.base`). Var och en lyder *Lolly default* tills du flyttar reglaget och *Yours* efteråt, sparas direkt och kan ångras.
- **More tokens** lägger till avstånd, storlekar, linjebredd, opacitet, rotation, vanliga tal och skuggor, lagrade som standard [designtokens](/info/design-tokens.html).
- **App appearance (advanced)** listar färgerna, storlekarna och skuggorna som Lollys egna skärmar använder, och **Inspect every token (advanced)** söker och redigerar vilket lagrat värde som helst, och visar varje ändring för granskning först. Där listas en färgrolls värden i varje färgvariant tillsammans med rollen: välj rollens token för att se en rad per färgvariant, ljust och mörkt sida vid sida, och antalsraden säger hur många värden rollerna har. Ett skrivskyddat designsystem visar samma lista.

Ett avsnitt utan innehåll erbjuder sättet att fylla luckan: **Pick a colour**, **Choose a face** eller **Add a logo**.

## Files

Släpp filerna som ditt varumärke behåller, förutom logotyper: **vector**-, **image**-, **audio**- och **motion**-filer (video, Lottie och animationer). De visas i [Assets](/info/using.html#assets-your-library), sorterade i avsnitt och redo i varje verktygs tillgångsväljare, och de stannar på den här enheten.

## Rules

**Rules** sätter ditt varumärkes val i arbete: vad folk kan ändra, vad som förblir fast och vad Lolly kan kontrollera.

![Rules på Lolly Demo: fyra husregler, var och en märkt Checked in Design och Obligatoriskt eller Rådgivande, sedan Try your design system in use med sina exempel redo att renderas](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** listar dina regler. **Add rule** (eller **Add your first rule**) öppnar ett kort formulär:

- ett **Regelnamn** med dina egna ord, till exempel *Beacon accents*;
- **kontrollen**: **Colour choices**, **Font choices**, **Fixed artwork** eller **Text length**, med den varumärkesroll den använder, under ditt eget namn för rollen;
- **exemplet** den gäller för (Poster, Title slide, Content slide eller Lolly Chart), **läget** och om den är **Obligatorisk** eller **Rådgivande**;
- **Granskad av**, sedan **Spara utkast** eller **Godkänn och spara**.

Godkännande registrerar ditt eget beslut på den här enheten. Godkända obligatoriska regler begränsar den återanvändbara affischen, och kontroller täcker bara exempel-PNG:erna; de ändrar inget annat verktyg.

Regler som ett designsystem har med sig i sin tokenfil, som godkända färgpar, textvikt och justering eller en logotyp per yta, listas här som **Checked in Design**. Lolly Design kontrollerar dem lager för lager i exportpanelens kort **Innan du exporterar**, och `lolly check` gör detsamma för ett sparat Lolly Design-dokument ([Before you export](/info/design.html#before-you-export)). En regel som det här bygget saknar kontroll för behålls som den levererades och märks **Inte kontrollerad**.

Lolly Demo har med sig fyra godkända husregler. Rubriker sätts aldrig med versaler: den regeln är obligatorisk, så `lolly check` rapporterar en rubrik med versaler som ett fel. De andra tre är rådgivande. Brödtext är vänsterjusterad. Primärmärken ligger på ljusa ytor och omvända märken på mörka. Streckade linjer betyder släpp här.

**Try your design system in use** renderar fyra exempel från den aktuella revisionen med **Rendera och kontrollera exempel**. Välj ett **läge** och **Try your own text** för rubriken, den stödjande texten och bildtexten. Varje exempel rapporterar vad som mättes, med **See checks & sources** och **Ladda ner kontrollrapport**, och **Make reusable poster** laddar ner en `.lolly` vars fasta layout och godkända indataval följer med filen. Exemplen är lokala: ingenting publiceras eller godkänns genom att köra en kontroll.

Ett bygge som levereras med ett fast varumärke visar samma regler och exempel skrivskyddade, under *This brand is set*.

## Skills

**Skills** listar det aktiva designsystemets [varumärkesfärdigheter](/info/brand-skills.html): varumärkets skrivna riktlinjer, en per disciplin, för människor och AI-agenter. Varje rad anger disciplinen, varumärkets egen status (**Draft** eller **Approved**), om färdigheten är offentlig eller intern och dess revision. Välj en rad för att läsa färdigheten bredvid dess täckning, som ställer färdighetens rader mot dina tokens: vad Lolly kontrollerar, vad som står i konflikt, vad som stämmer och vad som bara är vägledning.

**Download skill (.zip)** skriver färdigheten som en Agent Skills-mapp för ett agentverktyg, med kataloglänkar som pekar till den här Lolly, och **Copy as one file** lägger samma text på urklipp för ett chattfönster. Ett designsystem utan egna färdigheter listar en baslinje som Lolly skriver från dess tokens och husregler varje gång baslinjen läses. Rummet läser färdigheter och redigerar dem aldrig.

## Ta in ett varumärke

**Lägg till från…** i fältet öppnar en väljare som frågar vad du har, inte vilket format det är:

- **Designtokens eller en designfil**: DTCG- eller Tokens Studio-JSON, ett Penpot-projekt, en zip med tokenuppsättningar, ett Lolly-designsystempaket, en SVG, en `DESIGN.md` eller en varumärkessidemapp.
- **PDF**: en presentation eller en riktlinjefil, läst på den här enheten för sina färger, märken och inbäddade typsnitt.
- **Logotyp eller skärmbild**: en bild blir en föreslagen palett, läst på den här enheten. Den läser färger, inte typsnitt eller layout.
- **Sparad webbsida**: en HTML-fil och dess CSS-filer, eller inklistrad HTML eller CSS, upp till 20 filer och 2 MB. Bara texten du anger läses: länkade resurser hämtas inte och skript körs inte.
- **Typsnittsfil**: TTF, OTF eller WOFF. Öppnar rummet Type, där typsnittet installeras.
- **Webbplats**: en sida, läst för sina färger och sin typografi. Den här rutan visas bara på en enhet som kan läsa en sida, och säger vilken läsare den använder: appen på den här enheten, eller webbläsartillägget i en bakgrundsflik, inloggad som du. Att ange en URL fyller bara i fältet; att trycka på hämta är samtycket.

Välj källan för designfil så listar nästa kort de godkända formaten som ikonrutor, med hela kortet som ett släppmål. Du kan också släppa en fil direkt på studion.

![Importkortet - de godkända formaten leder som ikonplattor, och hela kortet är ett enda släppmål](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Ett **Lolly-designsystempaket** (`.lolly`, eller en äldre `.zip`) installeras i ett steg.
- En **Penpot**-export (`.penpot`) tar med sina designtokens.
- En **Design Tokens**-fil (W3C DTCG) eller **Tokens Studio**-fil (`.json`) tar med sina tokens. En beskrivning som ber en läsare ignorera instruktioner, hävdar behörigheter eller ber om att köra kod utelämnas, och importen säger var den satt. Det här är en kontroll rad för rad och missar annan formulering, så läs en fil från någon du inte känner innan du tillämpar tokens.
- En **vanlig SVG** skannas efter färger du väljer bland, där den första blir din primärfärg.
- En **`DESIGN.md`** (`.md`) går till **Prova de här färgerna** med sina tokens som skrivna. Dess text kan behållas som ett utkast till varumärkesfärdighet, och kortet flaggar rader som ber en läsare ignorera instruktioner, hävda behörigheter eller köra kod. Agenter och varumärkessidor ser inget utkast förrän du trycker på **Behåll den här färdigheten** i rummet Färdigheter, och en behållen färdighet förblir intern.
- En **varumärkessidemapp**, vald som mapp, släppt eller zippad, går till samma granskning. Varje fil kontrolleras mot mappens `brand.json`, och en som inte stämmer får hela mappen att avvisas. Den lägger till tokens. Logotyper och typsnitt stannar i mappen.

Lolly läser en varumärkessida från filer du anger. Den hämtar inte en annan webbplats adress.

### En fil med egna färgord

En tokenfil eller en `DESIGN.md` kan använda egna ord för sina färger, som main, accent, supporting och tertiary. När Lolly hittar sådana ord listar granskningen var och en innan något tillämpas: ordet, dess färg i varje utseende, token den kom från och vad Lolly skulle läsa den som. Lolly föreslår de avläsningarna utifrån orden ensamma, mot en kort lista, och använder ingen modell. Ett ord utanför listan kommer in som varumärkets eget, **Bara vid namn**. Byt namn på vilket ord som helst, säg vad det är till för, läs det som något annat, eller avmarkera det för att lämna det som en namngiven färg.

**Installera med dessa roller** skriver dem, och **Installera utan roller** installerar filen exakt som den kom. En fil utan sådana ord visar inget nytt steg. En fil som anger egna roller, till exempel en Lolly skrev, visar dem som skrivna och installerar dem oförändrade, och du kan redigera dem efteråt i rummet Colours. Terminalen har ingen granskning, så `lolly system import` behåller en angiven post och lämnar andra filers ord som namngivna färger.

### Granska en referens

En logotyp, skärmbild, webbplats eller sparad sida öppnar **Try these colours**: ett exempel i de föreslagna färgerna, en **Main colour** du kan ändra och ett namn för ett nytt system. En ruta förklarar vad tillämpningen gör: den **ersätter** de aktiva tokeninställningarna med den genererade paletten och standardstilarna, **behåller** dina typsnitt och biblioteksfiler och det tidigare systemet kan **återställas**. **Apply suggested settings** tillämpar de ljusa och mörka paletterna, efter en kontrollpunkt, och **Restore brand settings** kan ta tillbaka de gamla inställningarna. **Change reference** väljer en annan källa.

**Palette, source details and individual choices** visar vad som lästes, eventuella typsnittsnamn som hittades och förhandsvisningens kontrast. Typsnittsnamn är bara förslag; Type är fortfarande där du installerar ett typsnitt. Källdetaljerna kan innehålla typografi, mellanrum, utfyllnad och hörnvärden där de observerats, märkta **Not observed** annars. En sparad sida eller en inbyggd webbplatsläsning rapporterar deklarerade stilar, som sidan kanske inte använder, och webbläsartillägget kan rapportera uppmätta stilar från ett urval av synliga element. Det här är observationer: inget installeras, och källans avstånd ersätter aldrig dina egna. **Choose individual items in the tray** behåller enskilda poster, och **Download design context** sparar en JSON-rapport över observationer, föreslagna tokens och källinformation (med en SHA-256 av all tillhandahållen HTML eller CSS). Rapporten innehåller ingen rå sidtext och är inte ett signerat Content Credential.

PDF- och designfilsimporter behåller sina egna granskningskontroller. Poster i **Tray** ändrar ingenting förrän du lägger till dem i rummet som äger den sortens material. `#/start?source=<kind>` öppnar väljaren på en källa (`file`, `pdf`, `image`, `font`, `url`, `page`), och `?import` öppnar den enkla listan.

### Hitta och jämför en look

Öppna **Find a look** från Board eller från listan över designsystem i Settings. Bläddra bland system sparade på den här enheten och några återanvändbara Lolly-exempel, och sök på namn, färgtagg eller deklarerat typsnitt. **Closest to my current palette** sorterar efter uppmätt färglikhet, med matchande typsnitt som avgör vid lika; det är inget kvalitetsbetyg.

Klicka på en look för att förhandsgranska den i sitt sammanhang. Förhandsgranskning ändrar ingenting. Varje korts **Använd den här looken** använder den looken. Ett sparat system blir det aktiva, vilket inte redigerar något. Ett exempels färger går genom den vanliga kontrollpunkten in i det öppna designsystemet, vars logotyper, typsnitt och allt annat exemplet inte definierar förblir som de är. **Jämför looks** lägger en kryssruta på varje kort, så att du kan välja två och jämföra dem sida vid sida. **Återställ varumärkesinställningar** återställer föregående look. Sparade system har redigerbara **Sök taggar** under **Details and design context**. Exemplen är originella Lolly-färgrecept, utan skrapad samling och utan konto.

![Jämför Sunroom och Orchard sida vid sida innan endera färgsystemet tillämpas.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Behåll och flytta ditt designsystem

### Flytta ett varumärke mellan enheter

**Export** skriver en **`LollyBrand-….lolly`**-fil: dina tokens, typsnitt, logotyper och temaval, med ett integritetsmanifest som kontrolleras på vägen tillbaka in. Webbversioner före 1.0.7 kallade samma fil `.zip`, och den stavningen godtas fortfarande. **Tokens (.json)** skriver det rena designtokendokumentet ensamt, utan typsnitt eller logotyper, för ett arkiv, ett byggsteg eller ett annat tokenverktyg.

För att ta tillbaka ett använder du **Add from… → Design tokens or a design file**, eller släpper filen på studion. Så lämnar en kollega över ett varumärke till dig, eller så för du ett till en andra installation, utan konto och utan moln. [Samarbeta med partners](/info/partners.html) beskriver vad mer du ska skicka när den som tar emot ditt varumärke arbetar för en annan organisation. För att ta in ett varumärke från kommandoraden, se [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** paketerar typsnitten du lagt till i en installerbar RPM. Om du själv laddat upp något av dem ber Lolly dig först bekräfta att du får vidaredistribuera dem.

### Återställ tidigare inställningar

Öppna **More** i fältet, välj **Restore brand settings**, välj en daterad kontrollpunkt och tryck på **Restore**. Det återställer färger, typinställningar och andra tokens för det aktiva varumärket; typsnitts- och bildfiler förblir som de är. Lolly sparar dina nuvarande inställningar som **Before restore** först, så att du kan ångra en återställning även efter att ha stängt webbläsaren. De senaste 20 kontrollpunkterna behålls på den här enheten.

### Versioner

En publicerad version är en **permanent, namngiven kopia** som behålls på den här enheten. Den ändras aldrig, så ett verktyg eller en länk som fäster den (med `designv`) fortsätter rita samma sak. Ett system med något eget listar **Versions & publishing** i fältets meny **More**; efter din första publicering ansluter **Versions** till rummen. `#/start?area=versions` öppnar den direkt.

- **En version är permanent.** Det finns ännu ingen radering, och panelen säger det.
- **Borttagningar leder kompatibilitetskortet**, eftersom en borttagen token är det som får ett verktyg att gå sönder.
- **Publicering kan inte ångras; återställning kan.** *Restore latest from this version* är en vanlig redigering, med **Undo** erbjudet direkt.

**Publish only** behåller en version utan att ändra vad verktyg följer; **Publish and make active** gör att verktyg och appen följer den versionen. **Follow the latest again** sätter varje redigering live i samma stund du gör den.

### Publicera en varumärkessida

En [varumärkessida](/info/brand-page.html) är en adress för människor och för agenter: en sida som visar logotyperna, färgerna, typografin och exemplen, med samma fakta i filer bredvid sidan. **Publicera en varumärkessida**, under Versions & publishing, visar den levande sidan och, bredvid sidan:

- **Blir publikt**: varje fil, grupperad, med sin storlek.
- **Undanhållet**: det som hölls utanför, och varför. En logotyp utan registrerad licens stannar utanför tills du kryssar i logotypens namn. En typsnittsfil behöver en registrerad licens som tillåter vidare spridning, och sidan visar ett konturerat prov när filen stannar utanför. Interna varumärkesfärdigheter visas aldrig.
- **Vad som kontrollerades**: färgpar per färgvariant och läge, och husreglerna. Det här är mätningar, inte ett utlåtande.
- **Med egna ord**: ett användningsutlåtande och en kontakt. Sidan skriver ut det du skriver och Lolly lägger inte till någon licens eller juridisk utsaga. En växel stänger av raden "Made with Lolly" i sidfoten.
- **På exporter**: en växel som [registrerar sidans adress i det här designsystemets exporter](/info/brand-page.html#lead-back-from-your-files). Den är av tills du slår på den, den kräver en `https`-adress, och den följer inte med ett paket eller en kopia. Ett låst designsystem visar inte växeln, eftersom dess förvaltare bestämmer.

**Ladda ner mapp** sparar mappen som en ZIP som du kan lägga upp var du vill, och ingenting blir publikt förrän du gör det. I en terminal skriver `lolly system publish --out=<dir>` samma mapp. En instans som serverar varumärkessidor erbjuder också **Publicera till** sin adress, vilket är ett uttryckligt tryck, och går genom sin godkännandekedja när den har en. Ett hanterat designsystem publiceras bara när dess förvaltare tillåter det.

### Anslut en agent

**Anslut en agent**, på samma plats, ger dig text att klistra in och säger vad varje alternativ kan göra:

- **`AGENTS.md`** i ett projekt: agenter läser systemets namn och regler. Den ritar ingenting och behöver ingen server.
- **Lollys publika server**: ritar med Lolly Demo, vilket system du än har öppet här. Den behöver ingen nyckel.
- **Din instans**: ritar med de system instansen har, och läser en tjänsttoken från en miljövariabel. Bladet anger variabelns namn och visar aldrig en token.

När ingen värdad server ritar med ditt system säger bladet det.

## Hantera dina designsystem

Öppna **Settings → Preferences → Design systems** för att byta, lägga till eller ta bort system. **Open** väljer ett system och öppnar det här; **Make a new one** skapar ett lokalt system och öppnar det med namnfältet redo. Ett system är aktivt i taget, för hela enheten. [Brand architectures](/info/brand-architectures.html) hjälper till att avgöra när ett varumärke behöver ett eget designsystem.

**Var ett system kommer ifrån.** Systemet som en installations katalog tillhandahåller lyder **Came with this app**, eller **From this instance** i en app ansluten till en. Fäll ut **Catalogue source** för att se vem som tillhandahåller det, dess tokentillgång och namnrymd samt dess kända version eller kontrollsumma; om en uppdatering misslyckas märks cachat material.

**Hanterade system är skrivskyddade.** Ett system lyder **Hanteras av den här instansen** (eller **Hanteras av den här appen** i skrivbordsappen utan instans) när dess katalog låser systemet. Du kan använda och ladda ner det, och att öppna det här visar en skrivskyddad notis med **Gör en redigerbar kopia** och **Switch**, sedan dess färgroller och tokens utan redigeringskontroller. Dina egna lokala system förblir redigerbara, även när det hanterade kom först. Ett bygge med ett fast varumärke öppnar Lolly Design System Setup på *This brand is set*, med varumärkets tokens och användningsregler att läsa.

**Varje annat tillhandahållet system är ditt** att dölja, redigera och återställa, inklusive Lolly Demo och Lolly Starter på lolly.tools. Att redigera ett behåller dess namn och märker raden **Edited here**, och **Reset to original** i dess meny kastar ändringarna som gjorts på den här enheten. Det tomma startpaketet är undantaget: en första ändring där startar ett eget designsystem, så Lolly frågar en gång vad det nya systemet ska heta. [Lolly Demo i bruk](/info/lolly-demo-in-use.html#switch-to-your-own) visar vad ditt eget system ersätter.

### Att ta bort ett designsystem

Välj **Remove** i ett systems meny; bekräftelsen säger vilket system som är aktivt efteråt. Sparade sessioner, uppladdningar och material som delas med ett annat system blir kvar.

Att ta bort ett tillhandahållet system döljer det bara: dess katalogtillgångar blir kvar, **Bring back** visar det igen och det kommer tillbaka av sig självt om du tar bort allt annat. Att ta bort en importerad eller redigerad kopia tar inte bort det tillhandahållna systemet, dess logotyper eller dess typsnitt, och om kopian var aktiv blir det tillhandahållna systemet aktivt igen. Att ta bort en aktiv värdad kopia rensar bara den kopians anslutning; en separat vald instans förblir vald.

Att ändra vad en server levererar är en administratörsuppgift: dess operatör ändrar källkatalogen och driftsätter om, eller en Lolly Work-administratör granskar och tillämpar en serverändring. Ändringar här förblir lokala, med ett undantag: på en Lolly Work-instans som ger dig `brand.edit` erbjuder ett hanterat system också **Redigera för** den instansen, som öppnar en redigeringskopia, och **Skicka till** den instansen i **Versions** skickar tillbaka dess färger, färgvarianter, färgroller och varumärkessidans adress. [Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) beskriver vad en ändring kan ändra och hur instansen serverar ändringen. Se [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) och [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Använd designkontext utanför appen

**Download design context** sparar tokendokumentet, lösta färger, deklarerade typsnittsfamiljer, tillgångs-id, källbevis där sådana registrerats, täckning och uttryckliga regler, utan typsnittsfiler och utan bevis på äganderätt. Kommandoraden läser filen utan server: `lolly system import` gör den till terminalens designsystem och `lolly system check` kontrollerar Lolly Design-indata mot den sparade kontexten. [Bring your design system](/info/cli.html#bring-your-design-system) beskriver importen och [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) beskriver kontrollen, och en MCP-klient läser samma brief från `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Vart du ska gå härnäst

- **[Using Lolly](/info/using.html)**: verktygen, att spara, att dela och Tillgångar.
- **[Varumärkesarkitekturer](/info/brand-architectures.html)**: hur divisioner, produkter, understödda varumärken, kunder och säsonger motsvaras av designsystem, färgvarianter och logotypidentiteter.
- **[Arbeta med partner](/info/partners.html)**: att dela ditt varumärke med en partner, och att arbeta i ett varumärke du fått.
- **[Varumärkessidor](/info/brand-page.html)**: publicera ditt designsystem på en adress, som presskit och agentkit.
- **[Design Tokens](/info/design-tokens.html)**: tokenmodellen ditt varumärke skrivs i.
- **[Export a file](/info/exporting.html)**: tryckenheter, CMYK och formaten ditt varumärke renderas till.
