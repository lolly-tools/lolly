# Design System Setup

Din logotyp, dina färger och dina typsnitt hör hemma på ett ställe, så att varje verktyg, sida och export ritar med dem. Det stället är **Design System Setup**, på `#/start`, och dess slogan säger vad det är till för: *Make it yours*.

Börja med det du har. Släpp in en logotyp så läser Lolly dess färger. Välj ett typsnitt, eller släpp in typsnittsfilen som ditt företag licensierar. Varje ändring syns genom hela appen direkt. Din logotyp, dina typsnitt och dina tokens stannar på den här enheten. Att välja ett Google Font är det enda steget som når ut: Lolly frågar först och hämtar sedan familjen en gång.

När det ser rätt ut ger du designsystemet ett namn och trycker på **Export**. Du får en `.lolly`-fil att behålla, öppna på en annan enhet eller ge till en kollega. [Settings](/info/dashboard.html#design-system) visar det aktiva systemet skrivskyddat, och dess omslag länkar hit för redigering.

## Gör det till ditt på fem minuter

::: timeline
- <!--i:upload--> **Släpp din logotyp** på släppytan i **Logos**. Lolly läser dess form och dess färger.
- <!--i:palette--> **Använd de här färgerna.** Logotypens huvudfärg blir din primärfärg, och en mörk neutral från logotypen blir din textfärg.
- <!--i:font--> **Välj ett typsnitt** i **Type**: ett Google Font, eller en typsnittsfil du äger.
- <!--i:pentool--> **Döp systemet.** Din första redigering skapar ett eget designsystem, och Lolly frågar en gång efter dess namn.
- <!--i:download--> **Export** skriver hela systemet som en `LollyBrand-….lolly`-fil.
:::

Rubriken visar vilket designsystem du **Editing**, och dess namn är ett fält du kan ändra när som helst. När din första redigering frågar **What is this design system called?** fylls orden från din logotyp i om logotypen stavar ut dem. **Save name** behåller namnet; **Not now** behåller en platshållare tills du skriver ett i rubriken. Namnet märker systemet i Settings och när du byter, och blir namnet på filen **Export** skriver.

## Rummen

Studion är en uppsättning rum i en rail längs sidan, i ingen fast ordning: inget är numrerat och inget väntar på något annat. På en telefon blir railen en rad chips under rubriken.

![Studions rumsrail: Overview, Colours, Type, Logos, Tokens, Files och Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Rum | Vad du gör där | Länknyckel |
|---|---|---|
| **Overview** | Se vad systemet håller, med en dörr in till varje rum | `overview` |
| **Colours** | Lägg till färger, ge dem roller, bygg nyanser och en palett | `color` |
| **Type** | Välj de fyra typsnitt som appen, verktygen och varje export läser | `type` |
| **Logos** | Placera dina märken i varje orientering och behandling | `logos` |
| **Tokens** | Hörn, avstånd, skuggor och varje annat namngivet värde | `tokens` |
| **Files** | Bild-, ljud- och rörelsefilerna ditt varumärke behåller | `catalogue` |
| **Usage & rules** | Reglerna ditt varumärke tillämpar, kontrollerade på verkliga exempel | `usage` |

Länka till ett rum med `#/start?area=<key>`. Rummet Files behåller nyckeln `catalogue`, eftersom en rumsnyckel är ett permanent kontrakt, och `?tab=` fungerar fortfarande som ett äldre alias. En okänd nyckel öppnar Overview.

**Railens nederkant** håller åtgärderna för hela systemet snarare än för ett rum. **Add from…** tar in ett varumärke ([Ta in ett varumärke](#bring-a-brand-in)), och **Tray** håller det en skanning hittade som du ännu inte lagt till. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** och **Restore brand settings** behåller och flyttar systemet ([Behåll och flytta ditt designsystem](#keep-and-move-your-design-system)). Var och en visas först när det finns något för den att verka på.

## Översikt

Utan något valt ännu erbjuder Overview fyra sätt att börja. **Start from a reference** öppnar källväljaren för en logotyp, skärmbild, webbsida eller designfil, och **Pick a colour**, **Choose a face** och **Add a logo** öppnar de kontrollerna direkt. Att öppna en skriver ingenting, och **Explore the tools** finns där från start.

När något är ditt eget visar Overview vad du har, med dina egna antal först. Colours anger antalet färger, med ett dämpat `· N starter` där ärvda färger visas; dess band lägger dina färger först, sedan en hårfin linje, sedan de bleka startfärgerna. Type läses efter roll (*Inter for headings*, med *Starter for the rest* på raden under). Logos säger hur många platser som är fyllda (eller **Not set**), Tokens visar hörnradien och Files säger **Nothing yet** medan biblioteket är tomt. Varje block öppnar sitt rum.

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
- Räknas på Overview och i Tokens.
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

![Logoplatserna med Horizontal och Vertical öppnade: varje behandling är en plats för sig, och varje plats är valfri](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Anpassade märken** är märken som ditt varumärke kallar vid eget namn, som en ikon, ett vapen eller en favicon.
- **Fler identiteter.** Ett undervarumärke, en produkt eller ett event kan ha en egen full uppsättning: **+ Add another logo** och ge uppsättningen ett namn. Din huvuduppsättning är "Your logo". [Brand architectures](/info/brand-architectures.html) visar när en logotypidentitet är rätt block.
- **Lolly läser logotypens färger.** Ett kort under släppytan, och igen överst i Colours, listar logotypens färger och frågar **Which is the main colour?**, med den starkaste färgen redan vald (aldrig det vita den exporterades på). **Use these colours** lägger till dem i din palett, gör huvudfärgen till din primärfärg och, när logotypen har en mörk neutral som läses på papper, gör den till textfärg. **Not now** lämnar dem i Tray. På en alldeles ny installation tillämpas det troligaste svaret direkt, och kortet erbjuder **Undo** eller en annan huvudfärg. En SVG ger exakta färger; en PNG, JPEG eller WebP ger de färger som täcker en verklig andel av märket.

## Färger

Rummet växer med designsystemet: ett första besök är ett beslut, och resten kommer när paletten gör det.

### Den första färgen

Ett system utan egna färger öppnas på ett stort chip och ett fält, med en rad som säger att roller, nyanser och tryckinställningar kommer när systemet växer.

- **Chipet är väljaren.** Tryck på **Pick a colour** så öppnas studions OKLCH-kort, förifyllt med det fältet håller: ett namn, hjulet, de fyra rattarna, alfa och **Stored as**, med **Cancel** och **Add colour** längst ner. Inget når systemet förrän du trycker på **Add colour**.
- **Fältet tar vilken notation som helst**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` eller ett färgnamn. Klistra in en lista så blir den en rad chips att lägga till ett i taget eller med **Add all**.
- **Två sätt till att ta in.** **Pick a colour from the screen** använder pipetten där webbläsaren har en, och **Take colours from an image** läser en skärmbild eller ett foto på den här enheten.
- **Add är aldrig avstängd.** Med inget i fältet öppnar den väljaren; text den inte kan läsa får en rad under fältet som säger det.

Din första färg blir **primärfärgen**, och ett chip bekräftar det, till exempel *"Primary is now Vivid Violet"*, med **Fine-tune** för att justera färgen.


### När paletten växer

Dina färger sitter bredvid en förhandsvisning **In context** på en bred skärm, och ovanför den på en mindre. Förhandsvisningen visar en affisch, ett diagram eller ett gränssnittskort i din palett. Startfärger stannar i sin egen hopfällbara grupp.

![Rummet Colours på Lolly Demo: paletten i hopfällbara grupper, varje färg med sitt namn och hexvärde, och nedladdningspillret längst ner](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Färger-rummet efter att en färg lagts till, med dess palett och en levande kompositionsförhandsgranskning](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roller: det verktyg läser

**Roles** säger vilken färg som spelar vilken del i varje verktyg och export. De är valfria (tre lösa färger och inga roller är ett alldeles utmärkt system), vilken färg som helst kan ta en och kontrastavläsningen mäts mot ytan, APCA först. Varje rollrad visar en egen färg i full styrka, en startfärg som står in, eller **↳ follows Primary**.

När paletten har nyanser visar bandet alla sju roller ett verktyg kan läsa: Primary, Secondary, Surface, Text, Muted, Edge och On primary. On primary härleds från primärfärgen, lyder **Derived** och har ingen väljare.

Appens egen accent följer designsystemet som standard. Det är inställningen **Interface follows the design system** i **Settings → Appearance**; att stänga av den lämnar appens gränssnitt neutralt, medan verktyg, ytor och exporter följer designsystemet i båda fallen.

**Färgvarianter.** Ett designsystem kan hålla flera ledfärger, var och en vald per stycke. Lolly behåller varje färgvariant, men det här rummet kan ännu inte skapa en: en färgvariant skrivs i tokenfilen. På ett system med färgvarianter behöver varje färgvariant sin egen primär- och sekundärfärg, och sin egen yta när färgvarianterna färgar bakgrunden, så de rollerna förblir inställda i färgprovsredigeraren. [Lolly Demo i bruk](/info/lolly-demo-in-use.html#colourways-on-real-work) visar färgvarianter på verkligt arbete, och [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) har formatet.

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

Paletten listar dina färger i hopfällbara grupper, var och en med sin egen **+ Add**. Skapa och döp om grupper som du vill. En roll gör aldrig en andra ruta: en ruta som en roll pekar på bär ett litet märke i stället (**P**, **S**, **Su**, **T**). **Colour chart** under rutorna visar samma färger på OKLCH-**Wheel** (dra en prick för att färga om, klicka på tom yta för att lägga till ett färgprov) och diagrammet **Gamut**, som visar var det visningsbara omfånget slutar. `#/start?area=color&focus=chart` öppnar diagrammet direkt.

![Färgpaletten, varje grupp fällbar, med nedladdningspillret placerat längs nederkanten](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkeln är nyans, avståndet ut är kroma och gråtonerna följer en ljushetsskala nedför sidan](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klicka på ett färgprov för att öppna dess redigerare:

- **Rename** färgprovet.
- **Set the colour** på OKLCH-reglage, eller i **Hex**, **HSL**, **RGB** eller **CMYK**. Värdefältet läser och skriver i det aktiva rummet. CMYK här sätter skärmfärgen genom omvandling; för att låsa exakta färger, använd **Print substitutes**.
- **Stored as** väljer hur färgprovet sparas: **LCH** (standard, perceptuellt och med brett omfång), Hex, RGB eller HSL.
- **Use as** ger färgprovet en roll direkt. Tryck på en markerad roll igen för att rensa rollen.
- **Print substitutes** (hopfälld): lås **CMYK** från **Auto** till exakta färgvärden, eller ange en **Spot colour** med ett **Name** (som `PANTONE 186 C`), en valfri **Book** och en **Finish** för folie, prägling, blindprägling, partiell lack, soft touch eller en stansning, vikning eller perforering. Ett tryckeri använder de här spärrarna när du exporterar en CMYK-PDF eller TIFF; se [Färgprofiler](/info/exporting.html#colour-profiles).
- **In other spaces** (hopfälld): ett värde per färgrum, härlett eller skrivet av dig, och ett skrivet värde vinner vid export.

**Att radera ett färgprov** är säkert. Härledda nyanser och temaroller döljs, så inget som läser dem går sönder, medan färger du lagt till tas bort.

::: details Att arbeta med många färgprov
Varje färgprov har ett draghandtag. Dra för att ordna om inom en grupp, eller fokusera handtaget, tryck Space, använd piltangenterna och tryck Space igen för att släppa; Escape avbryter. För att flytta färger mellan grupper använder du redigerarens kontroll **Group** eller markerar flera och använder **Move to**.

Markering behöver inget läge. Fältet visas med den första markerade rutan och försvinner med den sista.

- **Dra på tom yta** för att rita en rektangel; varje ruta den rör vid går med i markeringen, över grupper. Ett hopfällt avsnitt lägger inte till något.
- **Shift-klick** tar ett intervall i läsordning, **Cmd/Ctrl-klick** växlar en ruta, och ett vanligt klick öppnar redigeraren.
- Varje grupprubrik har **Select all**, och **Cmd-A** med en ruta i fokus tar varje färg du äger, aldrig en startfärg.
- Rutnätet har ett enda tabbstopp: piltangenter flyttar, Shift-pilar utökar, Space växlar, Delete tar bort och Escape rensar. För att knuffa en kanal trycker du `l`, `c` eller `h` först.
- På en pekskärm trycker och håller du på en ruta för att starta en markering, och trycker sedan för att lägga till.

Fältet lyder **{n} selected**, sedan **Move to**, **Give a role** (varje färg tar nästa roll i tur och ordning), **Download** (markeringen i något av de sex palettformaten), **Duplicate** (en kopia av varje, placerad efter originalet), **Copy values** och **Delete**. En kopia öppnas direkt i redigeraren; flera förblir markerade. Ett Cmd/Ctrl-Z ångrar en hel samlad åtgärd.
:::

### Gradienter

Den valfria panelen **Gradients** bygger blandningstokens från paletten. Varje gradient har en förhandsvisning, 2 till 8 namngivna stopp och en vinkel. Ett stopp pekar på ett färgprov, så färga om färgprovet så följer gradienten. Blandningar körs i OKLCH.

Palettnedladdningarna (designtokens, CSS, SCSS, GIMP och Adobe Swatch Exchange) sitter i ett piller längst ner i paletten när det finns nyanser. [Ta din palett och dina typsnitt med dig överallt](/info/using.html#take-your-palette-and-fonts-anywhere) beskriver varje format.

## Typsnitt

Utan ett eget typsnitt är rummet ett kort: **Primary**, satt i lässtorlek i typsnittet som tjänar det i dag, med en **Starter**-tagg, en **Choose a face**-knapp och raden *"Nothing installs until you choose one."* Rubriker, kod och kursiv följer primärfärgen tills du väljer dem; **Choose them separately** visar deras kort.

![Typografi-rummet med inget snitt valt än - ett kort i läsbar storlek, en Standard-tagg på det och en fylld Välj ett snitt](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Välj ett typsnitt så öppnas rummet i fyra rollkort, listan Fonts och ett levande specimen:

- **Primary**: brödtext, knappar och varje verktyg.
- **Headings**: visningstypsnittet för `h1` och `h2`.
- **Code**: ett monospace-typsnitt för kod och data.
- **Italic**: en äkta kursiv för betoning, citat och sidokommentarer.

Ett kort är färgat bara där du installerat det typsnittet, och dess knapp säger **Change** på ett eget typsnitt och **Choose a face** överallt annars. Inget på ett kort bekräftar något: knappen öppnar jämförelsescenen för den rollen.

![De fyra rollkorten synliga - vart och ett satt i det snitt som tjänar det, med en Standard-tagg där ingen valt ett och Italic som följer primärfärgen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Jämförelsevyn

Scenen öppnas inne i rummet, under kortet du tryckte på, och korten viks till en rad så att scenen syns på en telefons första skärm. Escape avbryter och återför fokus till kortet.

1. Tryck på **Choose a face** på kortet.
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
- **Rutor** räknar varje sorts token och hoppar till dess avsnitt: Colours, Type, Logos, Shape and spacing, More och All tokens. De räknar det som är ditt eget, som Overview gör. På en telefon rullar rutorna i sidled.
- **Colours** börjar med paren som verktyg sätter ihop (text på yta, på primärfärg, dämpad på yta) med en APCA-avläsning i ljust och mörkt, och flaggar **Weak contrast** där ett par inte räcker. Sedan varje färggrupp: en ramp som en rad chips, andra färger med sitt värde och referensen som verktyg använder, som `{color.brand.spearmint}`. Tryck på en referens för att kopiera referensen. **Edit in Colours** öppnar en grupp i rummet Colours.
- **Type** och **Logos** listar typsnittet för varje roll och varje logotypplats, med **Edit in Type** och **Edit in Logos** när du har egna.
- **Shape and spacing** håller **Rounded corners** (`shape.radius`) och **Spacing rhythm** (`space.base`). Var och en lyder *Lolly default* tills du flyttar reglaget och *Yours* efteråt, sparas direkt och kan ångras.
- **More tokens** lägger till avstånd, storlekar, linjebredd, opacitet, rotation, vanliga tal och skuggor, lagrade som standard [designtokens](/info/design-tokens.html).
- **App appearance (advanced)** listar färgerna, storlekarna och skuggorna som Lollys egna skärmar använder, och **Inspect every token (advanced)** söker och redigerar vilket lagrat värde som helst, och visar varje ändring för granskning först.

Ett avsnitt utan innehåll erbjuder sättet att fylla luckan: **Pick a colour**, **Choose a face** eller **Add a logo**.

## Files

Släpp filerna som ditt varumärke behåller, förutom logotyper: **vector**-, **image**-, **audio**- och **motion**-filer (video, Lottie och animationer). De visas i [Assets](/info/using.html#assets-your-library), sorterade i avsnitt och redo i varje verktygs tillgångsväljare, och de stannar på den här enheten.

## Usage & rules

**Usage & rules** sätter ditt varumärkes val i arbete: vad folk kan ändra, vad som förblir fast och vad Lolly kan kontrollera.

![Usage & rules på Lolly Demo: ett tomt kort Brand rules med Add your first rule, sedan Try your brand in use med sina exempel redo att renderas](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** listar dina regler. **Add rule** (eller **Add your first rule**) öppnar ett kort formulär:

- ett **Rule name** med dina egna ord, som *Beacon accents*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** eller **Text length**, med varumärkesrollen den använder, under ditt eget namn på rollen;
- **Example** den gäller för (Poster, Title slide, Content slide eller Chart), **Mode** och om den är **Required** eller **Advisory**;
- **Reviewed by**, sedan **Save draft** eller **Approve & save**.

Godkännande registrerar ditt eget beslut på den här enheten. Godkända obligatoriska regler begränsar den återanvändbara affischen, och kontroller täcker bara exempel-PNG:erna; de ändrar inget annat verktyg.

Regler som ett designsystem medför i sin tokenfil, som godkända färgpar, textvikt och justering eller en logotyp per yta, listas här som **Checked in Design**. Design kontrollerar dem lager för lager i exportpanelens kort **Before you export**, och `lolly check` gör detsamma för ett sparat Design-dokument ([Innan du exporterar](/info/design.html#before-you-export)). En regel som det här bygget saknar kontroll för behålls som levererad och märks **Unchecked**.

**Try your brand in use** renderar fyra exempel från den aktuella revisionen med **Render & check examples**. Välj ett **Brand mode** och **Try your own text** för rubriken, stödtexten och bildtexten. Varje exempel redovisar vad som mättes, med **See checks & sources** och **Download check report**, och **Make reusable poster** laddar ner en `.lolly` vars fasta layout och godkända indataval följer med filen. Exemplen är lokala: inget publiceras eller godkänns genom att köra en kontroll.

Ett bygge som levereras med ett fast varumärke visar samma regler och exempel skrivskyddade, under *This brand is set*.

## Ta in ett varumärke

**Add from…** längst ner i railen öppnar en väljare som frågar vad du har, inte vilket format det är:

- **Design tokens or a design file**: DTCG- eller Tokens Studio-JSON, ett Penpot-projekt, en zip med tokenuppsättningar, ett Lolly-designsystempaket eller en SVG.
- **PDF**: en presentation eller en riktlinjefil, läst på den här enheten för sina färger, märken och inbäddade typsnitt.
- **Logo or screenshot**: en bild blir en föreslagen palett, läst på den här enheten. Den läser färger, inte typsnittet eller layouten.
- **Saved web page**: en HTML-fil och dess CSS-filer, eller inklistrad HTML eller CSS, upp till 20 filer och 2 MB. Bara texten du tillhandahåller läses: länkade resurser hämtas inte och skript körs inte.
- **Font file**: TTF, OTF eller WOFF. Öppnar rummet Type, där typsnittet installeras.
- **Website**: en sida, läst för sina färger och sin typografi. Den här rutan visas bara på en enhet som kan läsa en sida, och anger vilken läsare den använder: appen på den här enheten, eller webbläsartillägget i en bakgrundsflik, inloggad som du. Att ange en URL fyller bara i fältet; att trycka på hämta är samtycket.

Välj källan för designfil så listar nästa kort de godkända formaten som ikonrutor, med hela kortet som ett släppmål. Du kan också släppa en fil direkt på studion.

![Importkortet - de godkända formaten leder som ikonplattor, och hela kortet är ett enda släppmål](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Ett **Lolly design-system pack** (`.lolly`, eller en äldre `.zip`) installeras i ett steg.
- En **Penpot**-export (`.penpot`) tar med sina designtokens.
- En **Design Tokens**-fil (W3C DTCG) eller **Tokens Studio**-fil (`.json`) tar med sina tokens.
- En **plain SVG** skannas efter färger du väljer bland, där den första blir din primärfärg.

### Granska en referens

En logotyp, skärmbild, webbplats eller sparad sida öppnar **Try these colours**: ett exempel i de föreslagna färgerna, en **Main colour** du kan ändra och ett namn för ett nytt system. En ruta förklarar vad tillämpningen gör: den **ersätter** de aktiva tokeninställningarna med den genererade paletten och standardstilarna, **behåller** dina typsnitt och biblioteksfiler och det tidigare systemet kan **återställas**. **Apply suggested settings** tillämpar de ljusa och mörka paletterna, efter en kontrollpunkt, och **Restore brand settings** kan ta tillbaka de gamla inställningarna. **Change reference** väljer en annan källa.

**Palette, source details and individual choices** visar vad som lästes, eventuella typsnittsnamn som hittades och förhandsvisningens kontrast. Typsnittsnamn är bara förslag; Type är fortfarande där du installerar ett typsnitt. Källdetaljerna kan innehålla typografi, mellanrum, utfyllnad och hörnvärden där de observerats, märkta **Not observed** annars. En sparad sida eller en inbyggd webbplatsläsning rapporterar deklarerade stilar, som sidan kanske inte använder, och webbläsartillägget kan rapportera uppmätta stilar från ett urval av synliga element. Det här är observationer: inget installeras, och källans avstånd ersätter aldrig dina egna. **Choose individual items in the tray** behåller enskilda poster, och **Download design context** sparar en JSON-rapport över observationer, föreslagna tokens och källinformation (med en SHA-256 av all tillhandahållen HTML eller CSS). Rapporten innehåller ingen rå sidtext och är inte ett signerat Content Credential.

PDF- och designfilsimporter behåller sina egna granskningskontroller. Poster i **Tray** ändrar ingenting förrän du lägger till dem i rummet som äger den sortens material. `#/start?source=<kind>` öppnar väljaren på en källa (`file`, `pdf`, `image`, `font`, `url`, `page`), och `?import` öppnar den enkla listan.

### Hitta och jämför en look

Öppna **Find a look** från Overview eller från listan över designsystem i Settings. Bläddra bland system sparade på den här enheten och några återanvändbara Lolly-exempel, och sök på namn, färgtagg eller deklarerat typsnitt. **Closest to my current palette** sorterar efter uppmätt färglikhet, med matchande typsnitt som avgör vid lika; det är inget kvalitetsbetyg.

Välj en look för att granska den, eller två för att jämföra sida vid sida. Att välja ändrar ingenting. **Use this saved system** byter till det, och **Use these colours** tillämpar ett exempels färger genom den vanliga kontrollpunkten, med dina typsnitt bevarade. **Restore brand settings** återställer den tidigare looken. Sparade system har redigerbara **Search tags** under **Details and design context**. Exemplen är originalrecept på Lolly-färger, utan skrapad samling och utan konto.

![Jämför Sunroom och Orchard sida vid sida innan endera färgsystemet tillämpas.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Behåll och flytta ditt designsystem

### Flytta ett varumärke mellan enheter

**Export** skriver en **`LollyBrand-….lolly`**-fil: dina tokens, typsnitt, logotyper och temaval, med ett integritetsmanifest som kontrolleras på vägen tillbaka in. Webbversioner före 1.0.7 kallade samma fil `.zip`, och den stavningen godtas fortfarande. **Tokens (.json)** skriver det rena designtokendokumentet ensamt, utan typsnitt eller logotyper, för ett arkiv, ett byggsteg eller ett annat tokenverktyg.

För att ta tillbaka ett använder du **Add from… → Design tokens or a design file**, eller släpper filen på studion. Så lämnar en kollega över ett varumärke till dig, eller så för du ett till en andra installation, utan konto och utan moln. För att ta in ett varumärke från kommandoraden, se [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** paketerar typsnitten du lagt till i en installerbar RPM. Om du själv laddat upp något av dem ber Lolly dig först bekräfta att du får vidaredistribuera dem.

### Återställ tidigare inställningar

Välj **Restore brand settings**, välj en daterad kontrollpunkt och tryck på **Restore**. Det återställer färger, typinställningar och andra tokens för det aktiva varumärket; typsnitts- och bildfiler förblir som de är. Lolly sparar dina nuvarande inställningar som **Before restore** först, så att du kan ångra en återställning även efter att ha stängt webbläsaren. De senaste 20 kontrollpunkterna behålls på den här enheten.

### Versioner

En publicerad version är en **permanent, namngiven kopia** som behålls på den här enheten. Den ändras aldrig, så ett verktyg eller en länk som fäster den (med `designv`) fortsätter rita samma sak. Ett system med något eget visar en diskret länk **Versions & publishing** längst ner i railen; efter din första publicering blir den posten **Versions**. `#/start?area=versions` öppnar den direkt.

- **En version är permanent.** Det finns ännu ingen radering, och panelen säger det.
- **Borttagningar leder kompatibilitetskortet**, eftersom en borttagen token är det som får ett verktyg att gå sönder.
- **Publicering kan inte ångras; återställning kan.** *Restore latest from this version* är en vanlig redigering, med **Undo** erbjudet direkt.

**Publish only** behåller en version utan att ändra vad verktyg följer; **Publish and make active** gör att verktyg och appen följer den versionen. **Follow the latest again** sätter varje redigering live i samma stund du gör den.

## Hantera dina designsystem

Öppna **Settings → Preferences → Design systems** för att byta, lägga till eller ta bort system. **Open** väljer ett system och öppnar det här; **Make a new one** skapar ett lokalt system och öppnar det med namnfältet redo. Ett system är aktivt i taget, för hela enheten. [Brand architectures](/info/brand-architectures.html) hjälper till att avgöra när ett varumärke behöver ett eget designsystem.

**Var ett system kommer ifrån.** Systemet som en installations katalog tillhandahåller lyder **Came with this app**, eller **From this instance** i en app ansluten till en. Fäll ut **Catalogue source** för att se vem som tillhandahåller det, dess tokentillgång och namnrymd samt dess kända version eller kontrollsumma; om en uppdatering misslyckas märks cachat material.

**Hanterade system är skrivskyddade.** Ett system lyder **Managed by this instance** (eller **Managed by this app** i datorappen utan instans) när dess katalog låser systemet. Du kan använda och ladda ner det, och att öppna det här visar en skrivskyddad notis med **Make an editable copy** och **Switch**. Dina egna lokala system förblir redigerbara, även när det hanterade kom först. Ett bygge med ett fast varumärke öppnar Design System Setup på *This brand is set*, med varumärkets tokens och användningsregler att läsa.

**Varje annat tillhandahållet system är ditt** att dölja, redigera och återställa, inklusive Lolly Demo och Lolly Starter på lolly.tools. Att redigera ett behåller dess namn och märker raden **Edited here**, och **Reset to original** i dess meny kastar ändringarna som gjorts på den här enheten. Det tomma startpaketet är undantaget: en första ändring där startar ett eget designsystem, så Lolly frågar en gång vad det nya systemet ska heta. [Lolly Demo i bruk](/info/lolly-demo-in-use.html#switch-to-your-own) visar vad ditt eget system ersätter.

### Att ta bort ett designsystem

Välj **Remove** i ett systems meny; bekräftelsen säger vilket system som är aktivt efteråt. Sparade sessioner, uppladdningar och material som delas med ett annat system blir kvar.

Att ta bort ett tillhandahållet system döljer det bara: dess katalogtillgångar blir kvar, **Bring back** visar det igen och det kommer tillbaka av sig självt om du tar bort allt annat. Att ta bort en importerad eller redigerad kopia tar inte bort det tillhandahållna systemet, dess logotyper eller dess typsnitt, och om kopian var aktiv blir det tillhandahållna systemet aktivt igen. Att ta bort en aktiv värdad kopia rensar bara den kopians anslutning; en separat vald instans förblir vald.

Att ändra vad en server tillhandahåller är en administratörsuppgift: dess operatör ändrar källkatalogen och driftsätter om, eller en Lolly Work-administratör granskar och tillämpar en serverändring. Redigeringar här förblir lokala. Se [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) och [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Använd designkontext utanför appen

**Download design context** sparar tokendokumentet, upplösta färger, deklarerade typsnittsfamiljer, tillgångs-id:n, källbevis där de registrerats, täckning och uttryckliga regler, utan typsnittsfiler och utan bevis på ägande. Kommandoraden läser filen utan server: `lolly system import` gör den till terminalens designsystem och `lolly system check` kontrollerar Design-indata mot den sparade kontexten. [Ta in ditt designsystem](/info/cli.html#bring-your-design-system) beskriver importen och [Vilket designsystem ett kommando använder](/info/cli-decks.html#which-design-system-a-command-uses) beskriver kontrollen, och en MCP-klient läser samma underlag från `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Vart du ska gå härnäst

- **[Använda Lolly](/info/using.html)**: verktygen, att spara, dela och Assets.
- **[Varumärkesarkitekturer](/info/brand-architectures.html)**: hur divisioner, produkter, endorsed brands, kunder och säsonger avbildas på designsystem, färgvarianter och logotypidentiteter.
- **[Design Tokens](/info/design-tokens.html)**: tokenmodellen ditt varumärke är skrivet i.
- **[Exportera en fil](/info/exporting.html)**: tryckenheter, CMYK och formaten ditt varumärke renderas till.
